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

interface TickerItem {
  key: string;
  asset: Asset;
  position: number;
}

const ITEM_WIDTH = 200; // Approximate width of each ticker item in pixels
const SCROLL_SPEED = 50; // Pixels per second

const MarketTicker = () => {
  const [tickerItems, setTickerItems] = useState<TickerItem[]>([]);
  const pendingAssetsRef = useRef<Asset[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const itemCounterRef = useRef<number>(0);

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

  // Initialize ticker items
  useEffect(() => {
    const initTicker = async () => {
      const assets = await fetchAssets();
      if (assets.length === 0) return;

      const containerWidth = containerRef.current?.offsetWidth || window.innerWidth;
      const itemsNeeded = Math.ceil(containerWidth / ITEM_WIDTH) + 2;
      
      const initialItems: TickerItem[] = [];
      for (let i = 0; i < itemsNeeded; i++) {
        const asset = assets[i % assets.length];
        initialItems.push({
          key: `item-${itemCounterRef.current++}`,
          asset,
          position: i * ITEM_WIDTH,
        });
      }
      
      setTickerItems(initialItems);
      pendingAssetsRef.current = assets;
    };

    initTicker();
  }, [fetchAssets]);

  // Subscribe to real-time updates
  useEffect(() => {
    const channel = supabase
      .channel('ticker-updates')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'assets' },
        (payload) => {
          // Update prices for currently displayed assets
          setTickerItems(prev => 
            prev.map(item => 
              item.asset.id === payload.new.id 
                ? { 
                    ...item, 
                    asset: { 
                      ...item.asset, 
                      current_price: payload.new.current_price, 
                      price_change_24h: payload.new.price_change_24h 
                    }
                  }
                : item
            )
          );
          
          // Update pending assets for future replacements
          fetchAssets().then(newAssets => {
            if (newAssets.length > 0) {
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

  // Animation loop
  useEffect(() => {
    const animate = (currentTime: number) => {
      if (lastTimeRef.current === 0) {
        lastTimeRef.current = currentTime;
      }
      
      const deltaTime = (currentTime - lastTimeRef.current) / 1000;
      lastTimeRef.current = currentTime;
      
      const movement = SCROLL_SPEED * deltaTime;

      setTickerItems(prev => {
        const containerWidth = containerRef.current?.offsetWidth || window.innerWidth;
        const updated: TickerItem[] = [];
        let needsNewItem = false;
        let rightmostPosition = -Infinity;

        // Move items and find rightmost position
        for (const item of prev) {
          const newPosition = item.position - movement;
          rightmostPosition = Math.max(rightmostPosition, item.position);
          
          // If item is off-screen to the left, mark for removal
          if (newPosition < -ITEM_WIDTH) {
            needsNewItem = true;
            continue;
          }
          
          updated.push({
            ...item,
            position: newPosition,
          });
        }

        // Add new item on the right when one leaves
        if (needsNewItem && pendingAssetsRef.current.length > 0) {
          // Find the next asset to show (cycle through pending assets)
          const nextAssetIndex = itemCounterRef.current % pendingAssetsRef.current.length;
          const nextAsset = pendingAssetsRef.current[nextAssetIndex];
          
          updated.push({
            key: `item-${itemCounterRef.current++}`,
            asset: nextAsset,
            position: rightmostPosition,
          });
        }

        return updated;
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

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

  return (
    <div 
      ref={containerRef}
      className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-sm border-t border-border z-50 overflow-hidden h-10"
    >
      {tickerItems.map((item) => {
        const isPositive = (item.asset.price_change_24h || 0) >= 0;
        return (
          <div
            key={item.key}
            className="absolute flex items-center gap-2 px-4 py-2 whitespace-nowrap border-r border-border/50 h-full"
            style={{ 
              transform: `translateX(${item.position}px)`,
              willChange: 'transform',
            }}
          >
            <span className="font-semibold text-foreground text-sm">{item.asset.symbol}</span>
            <span className="text-muted-foreground text-sm">${formatPrice(item.asset.current_price)}</span>
            <span className={`flex items-center gap-1 font-medium text-sm ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
              {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {formatChange(item.asset.price_change_24h)}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export default MarketTicker;
