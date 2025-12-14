import { Card } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { TrendingUp, TrendingDown } from "lucide-react";

const Portfolio = () => {
  const { user } = useAuth();
  const [portfolio, setPortfolio] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;

    const fetchPortfolio = async () => {
      const { data } = await supabase
        .from("portfolios")
        .select(`
          *,
          assets (*)
        `)
        .eq("user_id", user.id)
        .gt("quantity", 0);

      if (data) {
        setPortfolio(data);
      }
    };

    fetchPortfolio();

    // Subscribe to portfolio changes
    const portfolioChannel = supabase
      .channel('portfolio-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'portfolios',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          fetchPortfolio();
        }
      )
      .subscribe();

    // Subscribe to asset price changes for real-time P&L updates
    const assetsChannel = supabase
      .channel('assets-price-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'assets'
        },
        () => {
          fetchPortfolio();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(portfolioChannel);
      supabase.removeChannel(assetsChannel);
    };
  }, [user]);

  return (
    <Card className="p-4">
      <h3 className="text-lg font-semibold mb-4">Portfolio</h3>
      
      {portfolio.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p>No positions yet</p>
          <p className="text-sm mt-1">Start trading to build your portfolio</p>
        </div>
      ) : (
        <div className="space-y-3">
          {portfolio.map((position: any) => {
            const currentPrice = Number(position.assets.current_price);
            const avgBuyPrice = Number(position.average_buy_price);
            const quantity = Number(position.quantity);
            const currentValue = currentPrice * quantity;
            const invested = avgBuyPrice * quantity;
            const pnl = currentValue - invested;
            const pnlPercent = (pnl / invested) * 100;
            const isProfit = pnl >= 0;

            return (
              <div
                key={position.id}
                className="p-3 bg-secondary rounded-lg hover:bg-secondary/80 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{position.assets.symbol}</span>
                      {isProfit ? (
                        <TrendingUp className="w-3 h-3 text-success" />
                      ) : (
                        <TrendingDown className="w-3 h-3 text-destructive" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {position.assets.name}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-sm font-semibold">
                      {quantity.toFixed(4)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      ${currentValue.toFixed(2)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <div>
                    <span className="text-muted-foreground">Avg: </span>
                    <span className="font-mono">${avgBuyPrice.toFixed(2)}</span>
                  </div>
                  <div className={isProfit ? "text-success" : "text-destructive"}>
                    <span className="font-mono font-semibold">
                      {isProfit ? "+" : ""}${pnl.toFixed(2)}
                    </span>
                    <span className="ml-1">
                      ({isProfit ? "+" : ""}{pnlPercent.toFixed(2)}%)
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
};

export default Portfolio;
