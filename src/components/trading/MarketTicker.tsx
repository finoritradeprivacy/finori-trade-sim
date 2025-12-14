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

const SCROLL_SPEED = 60; // Pixels per second

const MarketTicker = () => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [scrollPosition, setScrollPosition] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

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
    return [];
  }, []);

  // Initialize and subscribe to updates
  useEffect(() => {
    fetchAssets().then(data => {
      if (data.length > 0) setAssets(data);
    });

    const channel = supabase
      .channel('ticker-updates')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'assets' },
        (payload) => {
          // Update prices for currently displayed assets
          setAssets(prev => 
            prev.map(asset => 
              asset.id === payload.new.id 
                ? { 
                    ...asset, 
                    current_price: payload.new.current_price, 
                    price_change_24h: payload.new.price_change_24h 
                  }
                : asset
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAssets]);

  // Simple CSS-based animation with scroll position tracking
  useEffect(() => {
    if (assets.length === 0) return;

    const animate = (currentTime: number) => {
      if (lastTimeRef.current === 0) {
        lastTimeRef.current = currentTime;
      }
      
      const deltaTime = (currentTime - lastTimeRef.current) / 1000;
      lastTimeRef.current = currentTime;
      
      const movement = SCROLL_SPEED * deltaTime;
      const contentWidth = contentRef.current?.scrollWidth || 0;
      const halfWidth = contentWidth / 2;

      setScrollPosition(prev => {
        const newPos = prev + movement;
        // Reset when we've scrolled past the first set of items
        if (newPos >= halfWidth) {
          return newPos - halfWidth;
        }
        return newPos;
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [assets.length]);

  const formatPrice = (price: number) => {
    if (price >= 1000) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (price >= 1) return price.toFixed(2);
    return price.toFixed(4);
  };

  const formatChange = (change: number | null) => {
    if (change === null) return "0.00%";
    const percentValue = change * 100; // Convert from decimal (0.0014) to percent (0.14)
    const sign = percentValue >= 0 ? "+" : "";
    return `${sign}${percentValue.toFixed(2)}%`;
  };

  if (assets.length === 0) {
    return null;
  }

  // Duplicate items for seamless loop
  const tickerItems = [...assets, ...assets];

  return (
    <div 
      ref={containerRef}
      className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-sm border-t border-border z-50 overflow-hidden"
    >
      <div 
        ref={contentRef}
        className="flex whitespace-nowrap"
        style={{ 
          transform: `translateX(-${scrollPosition}px)`,
          willChange: 'transform',
        }}
      >
        {tickerItems.map((asset, index) => {
          const isPositive = (asset.price_change_24h || 0) >= 0;
          return (
            <div
              key={`${asset.id}-${index}`}
              className="flex items-center gap-2 px-6 py-2 border-r border-border/50"
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
