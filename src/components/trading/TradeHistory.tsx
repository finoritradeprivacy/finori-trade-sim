import { Card } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const TradeHistory = () => {
  const { user } = useAuth();
  const [trades, setTrades] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;

    const fetchTrades = async () => {
      const { data } = await supabase
        .from("orders")
        .select(`
          *,
          assets (*)
        `)
        .eq("user_id", user.id)
        .eq("status", "filled")
        .order("filled_at", { ascending: false })
        .limit(15);

      if (data) {
        setTrades(data);
      }
    };

    fetchTrades();

    const channel = supabase
      .channel('trades-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          fetchTrades();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return (
    <Card className="p-4">
      <h3 className="text-lg font-semibold mb-4">Recent Trades</h3>
      
      {trades.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p>No trades yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {trades.map((trade: any) => (
            <div
              key={trade.id}
              className="p-3 bg-secondary rounded-lg hover:bg-secondary/80 transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{trade.assets.symbol}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      trade.side === "buy" 
                        ? "bg-success/20 text-success" 
                        : "bg-destructive/20 text-destructive"
                    }`}>
                      {trade.side.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(trade.filled_at).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-muted-foreground">Price</p>
                  <p className="font-mono font-semibold">
                    ${Number(trade.average_fill_price).toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Quantity</p>
                  <p className="font-mono font-semibold">
                    {Number(trade.filled_quantity).toFixed(4)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};

export default TradeHistory;
