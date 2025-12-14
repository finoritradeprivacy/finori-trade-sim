import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, TrendingDown } from "lucide-react";

interface Asset {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  price_change_24h: number | null;
}

const MarketTicker = () => {
  const [displayedAssets, setDisplayedAssets] = useState<Asset[]>([]);
  const pendingAssetsRef = useRef<Asset[] | null>(null);
  const tickerRef = useRef<HTMLDivElement>(null);

  const fetchAssets = useCallback(async () => {
    const { data } = await supabase
      .from("assets")
      .select("id, symbol, name, current_price, price_change_24h")
      .eq("is_active", true)
      .order("price_change_24h", { ascending: false });
    
    if (data) {
      const sorted = [...data].sort((a, b) => 
        Math.abs(b.price_change_24h || 0) - Math.abs(a.price_change_24h || 0)
      );
      return sorted.slice(0, 10);
    }
    return null;
  }, []);

  useEffect(() => {
    // Initial fetch
    fetchAssets().then(assets => {
      if (assets) setDisplayedAssets(assets);
    });

    // Subscribe to real-time updates
    const channel = supabase
      .channel('ticker-updates')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'assets' },
        (payload) => {
          // Update prices for currently displayed assets only
          setDisplayedAssets(prev => 
            prev.map(asset => 
              asset.id === payload.new.id 
                ? { ...asset, current_price: payload.new.current_price, price_change_24h: payload.new.price_change_24h }
                : asset
            )
          );
          
          // Fetch new top movers but store them for later
          fetchAssets().then(newAssets => {
            if (newAssets) {
              pendingAssetsRef.current = newAssets;
            }
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAssets]);

  // Handle animation iteration - swap assets when ticker completes a cycle
  useEffect(() => {
    const ticker = tickerRef.current;
    if (!ticker) return;

    const handleAnimationIteration = () => {
      if (pendingAssetsRef.current) {
        setDisplayedAssets(pendingAssetsRef.current);
        pendingAssetsRef.current = null;
      }
    };

    ticker.addEventListener('animationiteration', handleAnimationIteration);
    return () => {
      ticker.removeEventListener('animationiteration', handleAnimationIteration);
    };
  }, []);

  const formatPrice = (price: number) => {
    if (price >= 1000) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (price >= 1) return price.toFixed(2);
    return price.toFixed(4);
  };

  const formatChange = (change: number | null) => {
    if (change === null) return "0.00%";
    const sign = change >= 0 ? "+" : "";
    return `${sign}${change.toFixed(2)}%`;
  };

  // Duplicate items for seamless loop
  const tickerItems = [...displayedAssets, ...displayedAssets];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-sm border-t border-border z-50 overflow-hidden">
      <div ref={tickerRef} className="flex animate-ticker">
        {tickerItems.map((asset, index) => {
          const isPositive = (asset.price_change_24h || 0) >= 0;
          return (
            <div
              key={`${asset.id}-${index}`}
              className="flex items-center gap-2 px-6 py-2 whitespace-nowrap border-r border-border/50"
            >
              <span className="font-semibold text-foreground">{asset.symbol}</span>
              <span className="text-muted-foreground">${formatPrice(asset.current_price)}</span>
              <span className={`flex items-center gap-1 font-medium ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {formatChange(asset.price_change_24h)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MarketTicker;
