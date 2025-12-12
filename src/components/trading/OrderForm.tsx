import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { z } from "zod";
import { AlertTriangle } from "lucide-react";
import { useAdmin } from "@/hooks/useAdmin";

const orderSchema = z.object({
  quantity: z.number()
    .positive({ message: "Quantity must be positive" })
    .max(1000000, { message: "Quantity exceeds maximum limit" })
    .finite({ message: "Quantity must be a valid number" }),
  price: z.number()
    .positive({ message: "Price must be positive" })
    .max(1000000, { message: "Price exceeds maximum limit" })
    .finite({ message: "Price must be a valid number" })
    .optional(),
  stopPrice: z.number()
    .positive({ message: "Stop price must be positive" })
    .max(1000000, { message: "Stop price exceeds maximum limit" })
    .finite({ message: "Stop price must be a valid number" })
    .optional()
});

interface OrderFormProps {
  asset: any;
}

const OrderForm = ({ asset }: OrderFormProps) => {
  const { user } = useAuth();
  const { isAdmin } = useAdmin();
  const [orderType, setOrderType] = useState("market");
  const [orderSubtype, setOrderSubtype] = useState("standard");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [stopPrice, setStopPrice] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailVerified, setEmailVerified] = useState(true);

  useEffect(() => {
    if (user) {
      // Check if email is confirmed
      setEmailVerified(user.email_confirmed_at !== null);
    }
  }, [user]);

  const handleSubmitOrder = async () => {
    if (!user || !asset) return;

    // Block trading if email not verified (except admins)
    if (!emailVerified && !isAdmin) {
      toast.error("Please verify your email before trading");
      return;
    }

    setLoading(true);

    try {
      // Validate inputs with Zod schema
      const validationResult = orderSchema.safeParse({
        quantity: Number(quantity),
        price: (orderType === "limit" || orderType === "stop") ? Number(price) : undefined,
        stopPrice: orderType === "stop" ? Number(stopPrice) : undefined
      });

      if (!validationResult.success) {
        toast.error(validationResult.error.errors[0].message);
        setLoading(false);
        return;
      }

      const orderPrice = orderType === "market" ? Number(asset.current_price) : Number(price);
      const orderQuantity = validationResult.data.quantity;

      if (orderType === "market") {
        // Use atomic database function for market orders
        const { data: orderId, error: rpcError } = await supabase.rpc('process_market_order', {
          p_user_id: user.id,
          p_asset_id: asset.id,
          p_side: side,
          p_quantity: orderQuantity,
          p_price: orderPrice
        });

        if (rpcError) {
          if (rpcError.message.includes('Insufficient balance')) {
            toast.error("Insufficient balance");
          } else if (rpcError.message.includes('Insufficient portfolio')) {
            toast.error("You don't own enough of this asset to sell");
          } else {
            throw rpcError;
          }
          setLoading(false);
          return;
        }

        toast.success(`${side === "buy" ? "Bought" : "Sold"} ${orderQuantity} ${asset.symbol}`);
      } else {
        // For limit/stop orders, insert directly
        const { error: orderError } = await supabase
          .from("orders")
          .insert({
            user_id: user.id,
            asset_id: asset.id,
            order_type: orderType,
            order_subtype: orderSubtype,
            side: side,
            quantity: orderQuantity,
            price: orderPrice,
            stop_price: orderType === "stop" ? Number(stopPrice) : null,
            status: "pending",
          });

        if (orderError) throw orderError;

        const orderTypeLabel = orderType === "stop" ? "Stop" : orderSubtype === "ioc" ? "IOC" : orderSubtype === "fok" ? "FOK" : "Limit";
        toast.success(`${orderTypeLabel} order placed successfully`);
      }

      setQuantity("");
      setPrice("");
      setStopPrice("");
    } catch (error: any) {
      toast.error(error.message || "Failed to place order");
    } finally {
      setLoading(false);
    }
  };

  if (!asset) return null;

  // Show warning if email not verified
  if (!emailVerified && !isAdmin) {
    return (
      <Card className="p-4">
        <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0" />
          <div>
            <p className="font-medium text-yellow-500">Email Not Verified</p>
            <p className="text-sm text-muted-foreground">Please verify your email to start trading.</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <Tabs value={side} onValueChange={(v) => setSide(v as "buy" | "sell")}>
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="buy" className="data-[state=active]:bg-success">
            Buy
          </TabsTrigger>
          <TabsTrigger value="sell" className="data-[state=active]:bg-destructive">
            Sell
          </TabsTrigger>
        </TabsList>

        <TabsContent value={side} className="space-y-4">
          <div className="space-y-2">
            <Label>Order Type</Label>
            <Select value={orderType} onValueChange={setOrderType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="market">Market</SelectItem>
                <SelectItem value="limit">Limit</SelectItem>
                <SelectItem value="stop">Stop</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {orderType === "limit" && (
            <div className="space-y-2">
              <Label>Order Execution</Label>
              <Select value={orderSubtype} onValueChange={setOrderSubtype}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="ioc">IOC (Immediate or Cancel)</SelectItem>
                  <SelectItem value="fok">FOK (Fill or Kill)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {(orderType === "limit" || orderType === "stop") && (
            <div className="space-y-2">
              <Label>Price (USDT)</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                step="0.01"
              />
            </div>
          )}

          {orderType === "stop" && (
            <div className="space-y-2">
              <Label>Stop Price (USDT)</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={stopPrice}
                onChange={(e) => setStopPrice(e.target.value)}
                step="0.01"
              />
              <p className="text-xs text-muted-foreground">
                Order triggers when price reaches this level
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Quantity ({asset.symbol})</Label>
            <Input
              type="number"
              placeholder="0.00"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              step="0.0001"
            />
          </div>

          <div className="p-3 bg-secondary rounded-lg space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total</span>
              <span className="font-mono font-semibold">
                {quantity && (orderType === "market" || price)
                  ? `${(Number(quantity) * (orderType === "market" ? Number(asset.current_price) : Number(price))).toFixed(2)} USDT`
                  : "0.00 USDT"}
              </span>
            </div>
          </div>

          <Button
            onClick={handleSubmitOrder}
            disabled={loading}
            className={`w-full ${
              side === "buy" 
                ? "bg-success hover:bg-success/90" 
                : "bg-destructive hover:bg-destructive/90"
            }`}
          >
            {loading ? "Processing..." : `${side === "buy" ? "Buy" : "Sell"} ${asset.symbol}`}
          </Button>
        </TabsContent>
      </Tabs>
    </Card>
  );
};

export default OrderForm;
