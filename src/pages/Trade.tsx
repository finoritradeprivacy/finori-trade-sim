import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/trading/Header";
import AssetSelector from "@/components/trading/AssetSelector";
import PriceChart from "@/components/trading/PriceChart";
import OrderBook from "@/components/trading/OrderBook";
import OrderForm from "@/components/trading/OrderForm";
import Portfolio from "@/components/trading/Portfolio";
import OpenOrders from "@/components/trading/OpenOrders";
import TradeHistory from "@/components/trading/TradeHistory";
import NewsFeed from "@/components/trading/NewsFeed";

const Trade = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [selectedAsset, setSelectedAsset] = useState<any>(null);
  const [assets, setAssets] = useState<any[]>([]);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

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
        <AssetSelector
          assets={assets}
          selectedAsset={selectedAsset}
          onSelectAsset={setSelectedAsset}
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-9 space-y-4">
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <div className="xl:col-span-2">
                <PriceChart asset={selectedAsset} />
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
