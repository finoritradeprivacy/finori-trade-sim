import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Bitcoin, LineChart, DollarSign } from "lucide-react";

interface AssetSelectorProps {
  assets: any[];
  selectedAsset: any;
  onSelectAsset: (asset: any) => void;
}

const AssetSelector = ({ assets, selectedAsset, onSelectAsset }: AssetSelectorProps) => {
  const [selectedCategory, setSelectedCategory] = useState<'crypto' | 'stocks' | 'forex'>('crypto');

  const filteredAssets = assets.filter(asset => asset.category === selectedCategory);

  const categories = [
    { id: 'crypto' as const, label: 'Crypto', icon: Bitcoin },
    { id: 'stocks' as const, label: 'Stocks', icon: LineChart },
    { id: 'forex' as const, label: 'Forex', icon: DollarSign },
  ];

  return (
    <Card className="p-4">
      <div className="flex gap-2 mb-4">
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
      
      <div className="flex gap-3 overflow-x-auto pb-2">
        {filteredAssets.map((asset) => {
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
                  <p className={cn(
                    "text-xs font-medium",
                    isPositive ? "text-success" : "text-destructive"
                  )}>
                    {isPositive ? "+" : ""}
                    {Number(asset.price_change_24h).toFixed(2)}%
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </Card>
  );
};

export default AssetSelector;
