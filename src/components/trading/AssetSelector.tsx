import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Bitcoin, LineChart, DollarSign, MoreVertical, Newspaper, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import AssetsOverviewDialog from "./AssetsOverviewDialog";
import { Challenges } from "./Challenges";

interface AssetSelectorProps {
  assets: any[];
  selectedAsset: any;
  onSelectAsset: (asset: any) => void;
}

const AssetSelector = ({ assets, selectedAsset, onSelectAsset }: AssetSelectorProps) => {
  const [selectedCategory, setSelectedCategory] = useState<'crypto' | 'stocks' | 'forex' | 'news' | 'challenges'>('crypto');
  const [showOverview, setShowOverview] = useState(false);
  const [pendingNews, setPendingNews] = useState<any[]>([]);
  const [, setTick] = useState(0);

  useEffect(() => {
    const fetchPendingNews = async () => {
      const { data } = await supabase
        .from("news_events")
        .select("*, assets!inner(id, symbol, name)")
        .not("scheduled_for", "is", null)
        .order("scheduled_for", { ascending: true });
      
      if (data) setPendingNews(data);
    };

    fetchPendingNews();

    // Update countdown every second
    const interval = setInterval(() => {
      setTick(prev => prev + 1);
    }, 1000);

    const channel = supabase
      .channel('news-updates-selector')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'news_events' },
        () => {
          fetchPendingNews();
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, []);

  const filteredAssets = (selectedCategory === 'news' || selectedCategory === 'challenges')
    ? [] 
    : assets.filter(asset => asset.category === selectedCategory);

  const categories = [
    { id: 'crypto' as const, label: 'Crypto', icon: Bitcoin },
    { id: 'stocks' as const, label: 'Stocks', icon: LineChart },
    { id: 'forex' as const, label: 'Forex', icon: DollarSign },
    { id: 'news' as const, label: 'News', icon: Newspaper },
    { id: 'challenges' as const, label: 'Challenges', icon: Trophy },
  ];

  const getCountdown = (scheduledFor: string) => {
    const now = Date.now();
    const scheduled = new Date(scheduledFor).getTime();
    const diff = scheduled - now;
    
    if (diff <= 0) return "Triggering...";
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <>
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="flex gap-2 flex-wrap flex-1">
            {categories.map(({ id, label, icon: Icon }) => (
              <Button
                key={id}
                variant={selectedCategory === id ? "default" : "outline"}
                onClick={() => setSelectedCategory(id)}
                className="flex items-center gap-2"
              >
                <Icon className="w-4 h-4" />
                {label}
              </Button>
            ))}
          </div>
          
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowOverview(true)}
            className="flex-shrink-0 bg-secondary/50 hover:bg-secondary border-primary/50"
            title="Assets Overview"
          >
            <MoreVertical className="w-4 h-4 text-primary" />
          </Button>
        </div>
      
      <div className="flex gap-3 overflow-x-auto pb-2">
          {selectedCategory === 'challenges' ? (
            <div className="w-full">
              <Challenges />
            </div>
          ) : selectedCategory === 'news' ? (
            pendingNews.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 w-full text-center">
                No pending news events
              </p>
            ) : (
              pendingNews.map((news) => (
                <button
                  key={news.id}
                  onClick={() => {
                    const asset = assets.find(a => a.id === news.asset_id);
                    if (asset) onSelectAsset(asset);
                  }}
                  className="flex-shrink-0 px-4 py-3 rounded-lg transition-all bg-primary/5 border-2 border-primary/20 hover:bg-primary/10 animate-pulse"
                >
                  <div className="flex items-center gap-3">
                    <Newspaper className="w-5 h-5 text-primary" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-lg">{news.assets.symbol}</span>
                      </div>
                      <p className="text-xs text-muted-foreground text-left">
                        {news.assets.name}
                      </p>
                    </div>
                    
                    <div className="text-right">
                      <p className="text-xs font-semibold text-primary mb-1">
                        📢 New event in
                      </p>
                      <p className="font-mono font-bold text-primary">
                        {getCountdown(news.scheduled_for)}
                      </p>
                    </div>
                  </div>
                </button>
              ))
            )
          ) : (
            filteredAssets.map((asset) => {
              const isPositive = Number(asset.price_change_24h) >= 0;
              const isSelected = selectedAsset?.id === asset.id;

              return (
                <button
                  key={asset.id}
                  onClick={() => onSelectAsset(asset)}
                  className={cn(
                    "flex-shrink-0 px-4 py-3 rounded-lg transition-all",
                    "hover:scale-105 active:scale-95",
                    isSelected
                      ? "bg-primary/20 border-2 border-primary"
                      : "bg-secondary/50 border border-border hover:bg-secondary"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-lg">{asset.symbol}</span>
                        {isPositive ? (
                          <TrendingUp className="w-4 h-4 text-success" />
                        ) : (
                          <TrendingDown className="w-4 h-4 text-destructive" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground text-left">
                        {asset.name}
                      </p>
                    </div>
                    
                    <div className="text-right">
                      <p className="font-mono font-semibold">
                        ${Number(asset.current_price).toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: asset.current_price < 1 ? 6 : 2
                        })}
                      </p>
                      <div className="flex items-center justify-end gap-2">
                        <p className={cn(
                          "text-xs font-medium",
                          isPositive ? "text-success" : "text-destructive"
                        )}>
                          {isPositive ? "+" : ""}
                          {Number(asset.price_change_24h).toFixed(2)}%
                        </p>
                        {asset.category === 'stocks' && asset.dividend_yield > 0 && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 font-medium">
                            {(asset.dividend_yield * 100).toFixed(1)}% DIV
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </Card>

      <AssetsOverviewDialog
        open={showOverview}
        onOpenChange={setShowOverview}
        assets={assets}
        selectedAsset={selectedAsset}
        onSelectAsset={onSelectAsset}
      />
    </>
  );
};

export default AssetSelector;
