import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Wifi, WifiOff, Clock } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ConnectionStatusProps {
  assetId?: string;
}

export const ConnectionStatus = ({ assetId }: ConnectionStatusProps) => {
  const [isConnected, setIsConnected] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [timeSinceUpdate, setTimeSinceUpdate] = useState<string>('');
  const channelRef = useRef<any>(null);

  useEffect(() => {
    // Subscribe to price updates to track connection
    const channel = supabase
      .channel('connection-status')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'assets' },
        () => {
          setLastUpdate(new Date());
          setIsConnected(true);
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
  }, []);

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
    </TooltipProvider>
  );
};
