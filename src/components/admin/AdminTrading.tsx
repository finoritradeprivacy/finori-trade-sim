import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { 
  TrendingUp, TrendingDown, Pause, Play, RefreshCw, Plus, Trash2,
  DollarSign, Settings, Eye, XCircle
} from 'lucide-react';
import { format } from 'date-fns';

interface Asset {
  id: string;
  symbol: string;
  name: string;
  category: string;
  current_price: number;
  price_change_24h: number | null;
  is_active: boolean;
}

interface OpenPosition {
  id: string;
  user_nickname: string;
  user_id: string;
  asset_symbol: string;
  asset_id: string;
  quantity: number;
  average_buy_price: number;
  current_value: number;
  unrealized_pnl: number;
}

interface Trade {
  id: string;
  user_nickname: string;
  asset_symbol: string;
  side: string;
  quantity: number;
  price: number;
  total_value: number;
  created_at: string;
}

export const AdminTrading = () => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [openPositions, setOpenPositions] = useState<OpenPosition[]>([]);
  const [recentTrades, setRecentTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [marketsEnabled, setMarketsEnabled] = useState({ crypto: true, stocks: true, forex: true });
  const [showAddAssetDialog, setShowAddAssetDialog] = useState(false);
  const [showPriceOverrideDialog, setShowPriceOverrideDialog] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [newPrice, setNewPrice] = useState('');
  const [newAsset, setNewAsset] = useState({ symbol: '', name: '', category: 'crypto', current_price: '' });
  const [priceFeedPaused, setPriceFeedPaused] = useState(false);

  useEffect(() => {
    fetchData();
    fetchTradingSettings();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch assets
      const { data: assetsData } = await supabase
        .from('assets')
        .select('*')
        .order('category', { ascending: true });
      setAssets(assetsData || []);

      // Fetch open positions with user and asset info
      const { data: positionsData } = await supabase
        .from('portfolios')
        .select('*, profiles!inner(nickname), assets!inner(symbol, current_price)')
        .gt('quantity', 0);

      const positions: OpenPosition[] = positionsData?.map((p: any) => ({
        id: p.id,
        user_nickname: p.profiles?.nickname || 'Unknown',
        user_id: p.user_id,
        asset_symbol: p.assets?.symbol || 'Unknown',
        asset_id: p.asset_id,
        quantity: Number(p.quantity),
        average_buy_price: Number(p.average_buy_price),
        current_value: Number(p.quantity) * Number(p.assets?.current_price || 0),
        unrealized_pnl: (Number(p.assets?.current_price || 0) - Number(p.average_buy_price)) * Number(p.quantity),
      })) || [];
      setOpenPositions(positions);

      // Fetch recent trades
      const { data: tradesData } = await supabase
        .from('trades')
        .select('*, profiles!inner(nickname), assets!inner(symbol)')
        .order('created_at', { ascending: false })
        .limit(50);

      const trades: Trade[] = tradesData?.map((t: any) => ({
        id: t.id,
        user_nickname: t.profiles?.nickname || 'Unknown',
        asset_symbol: t.assets?.symbol || 'Unknown',
        side: t.side,
        quantity: Number(t.quantity),
        price: Number(t.price),
        total_value: Number(t.total_value),
        created_at: t.created_at,
      })) || [];
      setRecentTrades(trades);
    } catch (error) {
      console.error('Error fetching trading data:', error);
      toast.error('Failed to fetch trading data');
    } finally {
      setLoading(false);
    }
  };

  const fetchTradingSettings = async () => {
    const { data } = await supabase
      .from('trading_settings')
      .select('*')
      .eq('setting_key', 'markets_enabled')
      .single();

    if (data) {
      const value = typeof data.setting_value === 'string' 
        ? JSON.parse(data.setting_value) 
        : data.setting_value;
      setMarketsEnabled(value);
    }
  };

  const handleToggleMarket = async (market: 'crypto' | 'stocks' | 'forex') => {
    const newSettings = { ...marketsEnabled, [market]: !marketsEnabled[market] };
    
    try {
      await supabase
        .from('trading_settings')
        .update({ setting_value: newSettings })
        .eq('setting_key', 'markets_enabled');

      setMarketsEnabled(newSettings);
      
      await supabase.rpc('log_admin_action', {
        p_action_type: 'toggle_market',
        p_entity_type: 'trading',
        p_entity_id: market,
        p_details: { enabled: newSettings[market] }
      });

      toast.success(`${market} market ${newSettings[market] ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Error toggling market:', error);
      toast.error('Failed to toggle market');
    }
  };

  const handleToggleAsset = async (asset: Asset) => {
    try {
      await supabase
        .from('assets')
        .update({ is_active: !asset.is_active })
        .eq('id', asset.id);

      await supabase.rpc('log_admin_action', {
        p_action_type: 'toggle_asset',
        p_entity_type: 'asset',
        p_entity_id: asset.id,
        p_details: { symbol: asset.symbol, is_active: !asset.is_active }
      });

      toast.success(`${asset.symbol} ${!asset.is_active ? 'activated' : 'deactivated'}`);
      fetchData();
    } catch (error) {
      console.error('Error toggling asset:', error);
      toast.error('Failed to toggle asset');
    }
  };

  const handlePriceOverride = async () => {
    if (!selectedAsset || !newPrice) return;

    try {
      const price = parseFloat(newPrice);
      await supabase
        .from('assets')
        .update({ current_price: price })
        .eq('id', selectedAsset.id);

      await supabase.rpc('log_admin_action', {
        p_action_type: 'price_override',
        p_entity_type: 'asset',
        p_entity_id: selectedAsset.id,
        p_details: { symbol: selectedAsset.symbol, old_price: selectedAsset.current_price, new_price: price }
      });

      toast.success(`Price updated for ${selectedAsset.symbol}`);
      setShowPriceOverrideDialog(false);
      setNewPrice('');
      fetchData();
    } catch (error) {
      console.error('Error overriding price:', error);
      toast.error('Failed to override price');
    }
  };

  const handleForceClosePosition = async (position: OpenPosition) => {
    try {
      // Get current price
      const { data: asset } = await supabase
        .from('assets')
        .select('current_price')
        .eq('id', position.asset_id)
        .single();

      if (!asset) throw new Error('Asset not found');

      // Execute sell order via RPC
      await supabase.rpc('process_market_order', {
        p_user_id: position.user_id,
        p_asset_id: position.asset_id,
        p_side: 'sell',
        p_quantity: position.quantity,
        p_price: asset.current_price,
      });

      await supabase.rpc('log_admin_action', {
        p_action_type: 'force_close_position',
        p_entity_type: 'portfolio',
        p_entity_id: position.id,
        p_details: { 
          user: position.user_nickname, 
          asset: position.asset_symbol, 
          quantity: position.quantity 
        }
      });

      toast.success(`Position force-closed for ${position.user_nickname}`);
      fetchData();
    } catch (error) {
      console.error('Error force closing position:', error);
      toast.error('Failed to force close position');
    }
  };

  const handleAddAsset = async () => {
    if (!newAsset.symbol || !newAsset.name || !newAsset.current_price) return;

    try {
      await supabase.from('assets').insert({
        symbol: newAsset.symbol.toUpperCase(),
        name: newAsset.name,
        category: newAsset.category,
        asset_type: newAsset.category,
        current_price: parseFloat(newAsset.current_price),
      });

      await supabase.rpc('log_admin_action', {
        p_action_type: 'add_asset',
        p_entity_type: 'asset',
        p_details: newAsset
      });

      toast.success(`Asset ${newAsset.symbol} added`);
      setShowAddAssetDialog(false);
      setNewAsset({ symbol: '', name: '', category: 'crypto', current_price: '' });
      fetchData();
    } catch (error) {
      console.error('Error adding asset:', error);
      toast.error('Failed to add asset');
    }
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="markets" className="w-full">
        <TabsList>
          <TabsTrigger value="markets">Markets & Assets</TabsTrigger>
          <TabsTrigger value="positions">Open Positions</TabsTrigger>
          <TabsTrigger value="trades">Trade History</TabsTrigger>
        </TabsList>

        <TabsContent value="markets" className="space-y-6">
          {/* Market Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Market Controls</span>
                <Button variant="outline" size="sm" onClick={() => setShowAddAssetDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Asset
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-yellow-500" />
                    <span>Crypto</span>
                  </div>
                  <Switch 
                    checked={marketsEnabled.crypto} 
                    onCheckedChange={() => handleToggleMarket('crypto')}
                  />
                </div>
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-blue-500" />
                    <span>Stocks</span>
                  </div>
                  <Switch 
                    checked={marketsEnabled.stocks} 
                    onCheckedChange={() => handleToggleMarket('stocks')}
                  />
                </div>
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="h-5 w-5 text-green-500" />
                    <span>Forex</span>
                  </div>
                  <Switch 
                    checked={marketsEnabled.forex} 
                    onCheckedChange={() => handleToggleMarket('forex')}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Assets List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Assets ({assets.length})</span>
                <Button variant="outline" size="sm" onClick={fetchData}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Symbol</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>24h Change</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assets.map((asset) => (
                      <TableRow key={asset.id}>
                        <TableCell className="font-mono font-bold">{asset.symbol}</TableCell>
                        <TableCell>{asset.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">{asset.category}</Badge>
                        </TableCell>
                        <TableCell className="font-mono">
                          ${asset.current_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                        </TableCell>
                        <TableCell className={asset.price_change_24h && asset.price_change_24h >= 0 ? 'text-green-500' : 'text-red-500'}>
                          {asset.price_change_24h?.toFixed(2) || 0}%
                        </TableCell>
                        <TableCell>
                          <Badge variant={asset.is_active ? 'default' : 'secondary'}>
                            {asset.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => { setSelectedAsset(asset); setShowPriceOverrideDialog(true); }}
                            >
                              <Settings className="h-4 w-4" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => handleToggleAsset(asset)}
                            >
                              {asset.is_active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="positions" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Open Positions ({openPositions.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Asset</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Avg Price</TableHead>
                      <TableHead>Current Value</TableHead>
                      <TableHead>Unrealized P/L</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {openPositions.map((position) => (
                      <TableRow key={position.id}>
                        <TableCell className="font-medium">{position.user_nickname}</TableCell>
                        <TableCell className="font-mono">{position.asset_symbol}</TableCell>
                        <TableCell>{position.quantity.toFixed(4)}</TableCell>
                        <TableCell className="font-mono">${position.average_buy_price.toLocaleString()}</TableCell>
                        <TableCell className="font-mono">${position.current_value.toLocaleString()}</TableCell>
                        <TableCell className={position.unrealized_pnl >= 0 ? 'text-green-500' : 'text-red-500'}>
                          ${position.unrealized_pnl.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>
                          <Button 
                            size="sm" 
                            variant="destructive"
                            onClick={() => handleForceClosePosition(position)}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Force Close
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {openPositions.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          No open positions
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trades" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent Trades</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Asset</TableHead>
                      <TableHead>Side</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentTrades.map((trade) => (
                      <TableRow key={trade.id}>
                        <TableCell className="text-muted-foreground text-sm">
                          {format(new Date(trade.created_at), 'MMM d, HH:mm')}
                        </TableCell>
                        <TableCell className="font-medium">{trade.user_nickname}</TableCell>
                        <TableCell className="font-mono">{trade.asset_symbol}</TableCell>
                        <TableCell>
                          <Badge variant={trade.side === 'buy' ? 'default' : 'destructive'}>
                            {trade.side.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell>{trade.quantity.toFixed(4)}</TableCell>
                        <TableCell className="font-mono">${trade.price.toLocaleString()}</TableCell>
                        <TableCell className="font-mono">${trade.total_value.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Asset Dialog */}
      <Dialog open={showAddAssetDialog} onOpenChange={setShowAddAssetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Asset</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Symbol</label>
              <Input 
                value={newAsset.symbol} 
                onChange={(e) => setNewAsset({ ...newAsset, symbol: e.target.value })}
                placeholder="BTC, AAPL, EUR/USD..."
              />
            </div>
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input 
                value={newAsset.name} 
                onChange={(e) => setNewAsset({ ...newAsset, name: e.target.value })}
                placeholder="Bitcoin, Apple Inc..."
              />
            </div>
            <div>
              <label className="text-sm font-medium">Category</label>
              <select 
                value={newAsset.category}
                onChange={(e) => setNewAsset({ ...newAsset, category: e.target.value })}
                className="w-full p-2 rounded border bg-background"
              >
                <option value="crypto">Crypto</option>
                <option value="stocks">Stocks</option>
                <option value="forex">Forex</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Initial Price</label>
              <Input 
                type="number"
                value={newAsset.current_price} 
                onChange={(e) => setNewAsset({ ...newAsset, current_price: e.target.value })}
                placeholder="100.00"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddAssetDialog(false)}>Cancel</Button>
            <Button onClick={handleAddAsset}>Add Asset</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Price Override Dialog */}
      <Dialog open={showPriceOverrideDialog} onOpenChange={setShowPriceOverrideDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Override Price: {selectedAsset?.symbol}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Current Price</label>
              <p className="font-mono text-lg">${selectedAsset?.current_price.toLocaleString()}</p>
            </div>
            <div>
              <label className="text-sm font-medium">New Price</label>
              <Input 
                type="number"
                value={newPrice} 
                onChange={(e) => setNewPrice(e.target.value)}
                placeholder="Enter new price..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPriceOverrideDialog(false)}>Cancel</Button>
            <Button onClick={handlePriceOverride}>Update Price</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
