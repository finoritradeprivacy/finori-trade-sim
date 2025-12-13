import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Wifi, WifiOff, Clock, TrendingUp, TrendingDown } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useSoundAlerts } from '@/hooks/useSoundAlerts';
import { toast } from 'sonner';

interface ConnectionStatusProps {
  assetId?: string;
}

interface MarketMovement {
  symbol: string;
  change: number;
  isPositive: boolean;
}

// Threshold for significant market movement (3% change)
const SIGNIFICANT_MOVEMENT_THRESHOLD = 3;

export const ConnectionStatus = ({ assetId }: ConnectionStatusProps) => {
  const [isConnected, setIsConnected] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [timeSinceUpdate, setTimeSinceUpdate] = useState<string>('');
  const [recentMovement, setRecentMovement] = useState<MarketMovement | null>(null);
  const channelRef = useRef<any>(null);
  const previousPricesRef = useRef<Map<string, { price: number; symbol: string }>>(new Map());
  const { playMarketMovementSound, soundEnabled } = useSoundAlerts();

  useEffect(() => {
    // Subscribe to price updates to track connection and significant movements
    const channel = supabase
      .channel('connection-status')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'assets' },
        (payload) => {
          setLastUpdate(new Date());
          setIsConnected(true);
          
          const newData = payload.new as any;
          const assetId = newData.id;
          const currentPrice = newData.current_price;
          const symbol = newData.symbol;
          
          // Check for significant price movement
          const previousData = previousPricesRef.current.get(assetId);
          if (previousData && previousData.price > 0) {
            const changePercent = ((currentPrice - previousData.price) / previousData.price) * 100;
            
            if (Math.abs(changePercent) >= SIGNIFICANT_MOVEMENT_THRESHOLD) {
              const isPositive = changePercent > 0;
              
              // Play sound and show notification
              playMarketMovementSound(isPositive);
              
              setRecentMovement({
                symbol,
                change: changePercent,
                isPositive
              });
              
              toast(
                isPositive ? 'Significant Price Increase!' : 'Significant Price Drop!',
                {
                  description: `${symbol} ${isPositive ? '📈' : '📉'} ${changePercent > 0 ? '+' : ''}${changePercent.toFixed(2)}%`,
                  duration: 5000
                }
              );
              
              // Clear movement indicator after 5 seconds
              setTimeout(() => setRecentMovement(null), 5000);
            }
          }
          
          // Update stored price
          previousPricesRef.current.set(assetId, { price: currentPrice, symbol });
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [playMarketMovementSound]);

  // Update time since last update every second
  useEffect(() => {
    const interval = setInterval(() => {
      if (lastUpdate) {
        const seconds = Math.floor((Date.now() - lastUpdate.getTime()) / 1000);
        if (seconds < 60) {
          setTimeSinceUpdate(`${seconds}s ago`);
        } else if (seconds < 3600) {
          setTimeSinceUpdate(`${Math.floor(seconds / 60)}m ago`);
        } else {
          setTimeSinceUpdate(`${Math.floor(seconds / 3600)}h ago`);
        }

        // Mark as disconnected if no update for 2+ minutes
        if (seconds > 120) {
          setIsConnected(false);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [lastUpdate]);

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-muted/50 text-xs">
              {isConnected ? (
                <Wifi className="h-3 w-3 text-profit" />
              ) : (
                <WifiOff className="h-3 w-3 text-loss" />
              )}
              <span className={isConnected ? 'text-profit' : 'text-loss'}>
                {isConnected ? 'Live' : 'Disconnected'}
              </span>
              {lastUpdate && (
                <>
                  <span className="text-muted-foreground">•</span>
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">{timeSinceUpdate}</span>
                </>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {isConnected 
                ? 'Connected to real-time price feed' 
                : 'Connection lost - prices may be stale'}
            </p>
            {lastUpdate && (
              <p className="text-xs text-muted-foreground">
                Last update: {lastUpdate.toLocaleTimeString()}
              </p>
            )}
          </TooltipContent>
        </Tooltip>

        {recentMovement && (
          <div className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs animate-pulse ${
            recentMovement.isPositive ? 'bg-profit/20 text-profit' : 'bg-loss/20 text-loss'
          }`}>
            {recentMovement.isPositive ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            <span className="font-medium">
              {recentMovement.symbol} {recentMovement.change > 0 ? '+' : ''}{recentMovement.change.toFixed(1)}%
            </span>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
};
