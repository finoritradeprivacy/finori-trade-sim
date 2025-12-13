import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { usePriceUpdates } from "@/hooks/usePriceUpdates";
import Header from "@/components/trading/Header";
import AssetSelector from "@/components/trading/AssetSelector";
import { TradingChart } from "@/components/trading/TradingChart";
import OrderBook from "@/components/trading/OrderBook";
import OrderForm from "@/components/trading/OrderForm";
import Portfolio from "@/components/trading/Portfolio";
import OpenOrders from "@/components/trading/OpenOrders";
import TradeHistory from "@/components/trading/TradeHistory";
import NewsFeed from "@/components/trading/NewsFeed";
import PlayerProfile from "@/components/trading/PlayerProfile";
import { PriceAlerts } from "@/components/trading/PriceAlerts";
import { ConnectionStatus } from "@/components/trading/ConnectionStatus";

const Trade = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [selectedAsset, setSelectedAsset] = useState<any>(null);
  const [assets, setAssets] = useState<any[]>([]);
  
  // Enable automatic price updates every 10 seconds
  usePriceUpdates();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  // Track played time every minute
  useEffect(() => {
    if (!user) return;

    const updatePlayedTime = async () => {
      // Use raw SQL call since RPC types may not be updated yet
      await supabase.from("profiles").update({
        last_active_at: new Date().toISOString()
      }).eq("id", user.id);
      
      // Increment played time using raw query
      await supabase.rpc('increment_played_time' as any, { p_user_id: user.id, p_seconds: 60 });
    };

    const interval = setInterval(updatePlayedTime, 60000);

    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    const fetchAssets = async () => {
      const { data } = await supabase
        .from("assets")
        .select("*")
        .eq("is_active", true)
        .order("market_cap", { ascending: false });
      
      if (data && data.length > 0) {
        setAssets(data);
        setSelectedAsset(data[0]);
      }
    };

    fetchAssets();

    // Subscribe to real-time updates for asset prices
    const channel = supabase
      .channel('assets-updates')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'assets' },
        (payload) => {
          setAssets(prev => 
            prev.map(asset => 
              asset.id === payload.new.id ? payload.new : asset
            )
          );
          // Update selected asset if it's the one that changed
          setSelectedAsset(prev => 
            prev?.id === payload.new.id ? payload.new : prev
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto p-4 space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <AssetSelector
            assets={assets}
            selectedAsset={selectedAsset}
            onSelectAsset={setSelectedAsset}
          />
          <ConnectionStatus assetId={selectedAsset?.id} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-9 space-y-4">
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <div className="xl:col-span-2">
                <TradingChart asset={selectedAsset} />
              </div>
              <div className="xl:col-span-1">
                <NewsFeed />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <OpenOrders />
              <TradeHistory />
            </div>
          </div>

          <div className="lg:col-span-3 space-y-4">
            <PlayerProfile />
            <PriceAlerts assets={assets} selectedAsset={selectedAsset} />
            <OrderBook asset={selectedAsset} />
            <OrderForm asset={selectedAsset} />
            <Portfolio />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Trade;
