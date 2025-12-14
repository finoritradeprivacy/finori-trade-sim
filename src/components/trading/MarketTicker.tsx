import { useEffect, useState } from "react";
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
  const [assets, setAssets] = useState<Asset[]>([]);

  useEffect(() => {
    const fetchAssets = async () => {
      const { data } = await supabase
        .from("assets")
        .select("id, symbol, name, current_price, price_change_24h")
        .eq("is_active", true)
        .order("price_change_24h", { ascending: false });
      
      if (data) {
        // Sort by absolute change to show biggest movers
        const sorted = [...data].sort((a, b) => 
          Math.abs(b.price_change_24h || 0) - Math.abs(a.price_change_24h || 0)
        );
        setAssets(sorted.slice(0, 10)); // Top 10 movers
      }
    };

    fetchAssets();

    const channel = supabase
      .channel('ticker-updates')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'assets' },
        () => {
          // Refetch all assets to get updated top movers
          fetchAssets();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
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
  const tickerItems = [...assets, ...assets];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-sm border-t border-border z-50 overflow-hidden">
      <div className="flex animate-ticker">
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
