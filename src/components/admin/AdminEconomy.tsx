import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { 
  DollarSign, Settings, Trophy, RefreshCw, Plus, Minus, Zap, TrendingUp, Percent
} from 'lucide-react';
import { Slider } from '@/components/ui/slider';

interface TradingSetting {
  id: string;
  setting_key: string;
  setting_value: any;
  description: string;
}

interface TopTrader {
  id: string;
  nickname: string;
  total_profit_loss: number;
  total_trades: number;
  win_rate: number;
  level: number;
}

interface StockAsset {
  id: string;
  symbol: string;
  name: string;
  dividend_yield: number;
  current_price: number;
}

export const AdminEconomy = () => {
  const [settings, setSettings] = useState<TradingSetting[]>([]);
  const [topTraders, setTopTraders] = useState<TopTrader[]>([]);
  const [stockAssets, setStockAssets] = useState<StockAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModifyBalanceDialog, setShowModifyBalanceDialog] = useState(false);
  const [showModifyLevelDialog, setShowModifyLevelDialog] = useState(false);
  const [showDividendDialog, setShowDividendDialog] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedStock, setSelectedStock] = useState<StockAsset | null>(null);
  const [dividendYield, setDividendYield] = useState(4.8);
  const [modifyAmount, setModifyAmount] = useState('');
  const [modifyType, setModifyType] = useState<'add' | 'remove'>('add');
  const [users, setUsers] = useState<{ id: string; nickname: string; balance: number; level: number }[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [stockSearchTerm, setStockSearchTerm] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch trading settings
      const { data: settingsData } = await supabase
        .from('trading_settings')
        .select('*')
        .order('setting_key');
      setSettings(settingsData || []);

      // Fetch stock assets with dividend yields
      const { data: stocksData } = await supabase
        .from('assets')
        .select('id, symbol, name, dividend_yield, current_price')
        .eq('category', 'stocks')
        .eq('is_active', true)
        .order('symbol');
      setStockAssets(stocksData || []);
      // Fetch top traders
      const { data: tradersData } = await supabase
        .from('profiles')
        .select('id, nickname, total_profit_loss, total_trades, win_rate')
        .order('total_profit_loss', { ascending: false })
        .limit(10);

      // Fetch levels
      const { data: statsData } = await supabase.from('player_stats').select('user_id, level');
      const levelMap = new Map(statsData?.map(s => [s.user_id, s.level]) || []);

      const traders: TopTrader[] = tradersData?.map(t => ({
        id: t.id,
        nickname: t.nickname,
        total_profit_loss: Number(t.total_profit_loss) || 0,
        total_trades: t.total_trades || 0,
        win_rate: Number(t.win_rate) || 0,
        level: levelMap.get(t.id) || 1,
      })) || [];
      setTopTraders(traders);

      // Fetch all users for balance/level modification
      const { data: usersData } = await supabase.from('profiles').select('id, nickname');
      const { data: balancesData } = await supabase.from('user_balances').select('user_id, usdt_balance');
      const balanceMap = new Map(balancesData?.map(b => [b.user_id, b.usdt_balance]) || []);

      setUsers(usersData?.map(u => ({
        id: u.id,
        nickname: u.nickname,
        balance: balanceMap.get(u.id) || 0,
        level: levelMap.get(u.id) || 1,
      })) || []);
    } catch (error) {
      console.error('Error fetching economy data:', error);
      toast.error('Failed to fetch economy data');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSetting = async (setting: TradingSetting, newValue: any) => {
    try {
      await supabase
        .from('trading_settings')
        .update({ setting_value: newValue })
        .eq('id', setting.id);

      await supabase.rpc('log_admin_action', {
        p_action_type: 'update_trading_setting',
        p_entity_type: 'trading_settings',
        p_entity_id: setting.id,
        p_details: { key: setting.setting_key, old_value: setting.setting_value, new_value: newValue }
      });

      toast.success(`Setting "${setting.setting_key}" updated`);
      fetchData();
    } catch (error) {
      console.error('Error updating setting:', error);
      toast.error('Failed to update setting');
    }
  };

  const handleModifyBalance = async () => {
    if (!selectedUserId || !modifyAmount) return;

    try {
      const amount = parseFloat(modifyAmount);
      const change = modifyType === 'add' ? amount : -amount;

      const { data: currentBalance } = await supabase
        .from('user_balances')
        .select('usdt_balance')
        .eq('user_id', selectedUserId)
        .single();

      const newBalance = Math.max(0, (currentBalance?.usdt_balance || 0) + change);

      await supabase
        .from('user_balances')
        .update({ usdt_balance: newBalance })
        .eq('user_id', selectedUserId);

      await supabase.rpc('log_admin_action', {
        p_action_type: 'modify_balance',
        p_entity_type: 'user',
        p_entity_id: selectedUserId,
        p_details: { change, new_balance: newBalance }
      });

      toast.success(`Balance ${modifyType === 'add' ? 'increased' : 'decreased'} by $${amount.toLocaleString()}`);
      setShowModifyBalanceDialog(false);
      setModifyAmount('');
      fetchData();
    } catch (error) {
      console.error('Error modifying balance:', error);
      toast.error('Failed to modify balance');
    }
  };

  const handleModifyLevel = async () => {
    if (!selectedUserId || !modifyAmount) return;

    try {
      const amount = parseInt(modifyAmount);
      const change = modifyType === 'add' ? amount : -amount;

      const { data: currentStats } = await supabase
        .from('player_stats')
        .select('level, total_xp')
        .eq('user_id', selectedUserId)
        .single();

      const newLevel = Math.max(1, (currentStats?.level || 1) + change);
      // Calculate XP needed for new level (simplified)
      const newXp = newLevel * 1000;

      await supabase
        .from('player_stats')
        .update({ level: newLevel, total_xp: newXp })
        .eq('user_id', selectedUserId);

      await supabase.rpc('log_admin_action', {
        p_action_type: 'modify_level',
        p_entity_type: 'user',
        p_entity_id: selectedUserId,
        p_details: { change, new_level: newLevel }
      });

      toast.success(`Level ${modifyType === 'add' ? 'increased' : 'decreased'} by ${amount}`);
      setShowModifyLevelDialog(false);
      setModifyAmount('');
      fetchData();
    } catch (error) {
      console.error('Error modifying level:', error);
      toast.error('Failed to modify level');
    }
  };

  const handleUpdateDividendYield = async () => {
    if (!selectedStock) return;

    try {
      const newYield = dividendYield / 100; // Convert from percent to decimal

      await supabase
        .from('assets')
        .update({ dividend_yield: newYield })
        .eq('id', selectedStock.id);

      await supabase.rpc('log_admin_action', {
        p_action_type: 'update_dividend_yield',
        p_entity_type: 'asset',
        p_entity_id: selectedStock.id,
        p_details: { 
          symbol: selectedStock.symbol, 
          old_yield: selectedStock.dividend_yield, 
          new_yield: newYield 
        }
      });

      toast.success(`Dividend yield for ${selectedStock.symbol} updated to ${dividendYield}%`);
      setShowDividendDialog(false);
      fetchData();
    } catch (error) {
      console.error('Error updating dividend yield:', error);
      toast.error('Failed to update dividend yield');
    }
  };

    const value = setting.setting_value;
    const key = setting.setting_key;

    // Simple number settings
    if (['initial_balance', 'max_leverage', 'max_position_size', 'max_open_positions', 'global_stop_loss_percent', 'trading_fee_percent'].includes(key)) {
      return (
        <Input 
          type="number"
          value={typeof value === 'object' ? JSON.stringify(value) : value}
          onChange={(e) => handleUpdateSetting(setting, parseFloat(e.target.value) || 0)}
          className="w-32"
        />
      );
    }

    // Complex object settings - just show a summary
    if (typeof value === 'object') {
      return (
        <span className="text-sm text-muted-foreground font-mono">
          {JSON.stringify(value)}
        </span>
      );
    }

    return <span>{String(value)}</span>;
  };

  const filteredUsers = users.filter(u => 
    u.nickname.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredStocks = stockAssets.filter(s =>
    s.symbol.toLowerCase().includes(stockSearchTerm.toLowerCase()) ||
    s.name.toLowerCase().includes(stockSearchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Risk Management Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Trading & Risk Settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {settings.map((setting) => (
              <div key={setting.id} className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                <div>
                  <p className="font-medium capitalize">{setting.setting_key.replace(/_/g, ' ')}</p>
                  <p className="text-sm text-muted-foreground">{setting.description}</p>
                </div>
                {getSettingInput(setting)}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Balance & Level Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Balance & Level Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Input
              placeholder="Search user..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <div className="max-h-64 overflow-y-auto space-y-2">
              {filteredUsers.slice(0, 20).map((user) => (
                <div key={user.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div>
                    <p className="font-medium">{user.nickname}</p>
                    <p className="text-sm text-muted-foreground">
                      Balance: ${user.balance.toLocaleString()} | Level: {user.level}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => { 
                        setSelectedUserId(user.id); 
                        setShowModifyBalanceDialog(true); 
                      }}
                    >
                      <DollarSign className="h-4 w-4 mr-1" />
                      Balance
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => { 
                        setSelectedUserId(user.id); 
                        setShowModifyLevelDialog(true); 
                      }}
                    >
                      <Zap className="h-4 w-4 mr-1" />
                      Level
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dividend Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Percent className="h-5 w-5 text-green-500" />
            Stock Dividend Yields
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Input
              placeholder="Search stocks..."
              value={stockSearchTerm}
              onChange={(e) => setStockSearchTerm(e.target.value)}
            />
            <div className="max-h-64 overflow-y-auto space-y-2">
              {filteredStocks.map((stock) => (
                <div key={stock.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div>
                    <p className="font-medium">{stock.symbol}</p>
                    <p className="text-sm text-muted-foreground">{stock.name}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Current yield</p>
                      <Badge variant={stock.dividend_yield > 0 ? 'default' : 'secondary'} className={stock.dividend_yield > 0 ? 'bg-green-500/20 text-green-400' : ''}>
                        {(stock.dividend_yield * 100).toFixed(1)}%
                      </Badge>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => { 
                        setSelectedStock(stock); 
                        setDividendYield(stock.dividend_yield * 100);
                        setShowDividendDialog(true); 
                      }}
                    >
                      <TrendingUp className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Top Traders Leaderboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rank</TableHead>
                <TableHead>Trader</TableHead>
                <TableHead>Level</TableHead>
                <TableHead>Total P/L</TableHead>
                <TableHead>Trades</TableHead>
                <TableHead>Win Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topTraders.map((trader, index) => (
                <TableRow key={trader.id}>
                  <TableCell>
                    <Badge variant={index < 3 ? 'default' : 'secondary'}>
                      #{index + 1}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{trader.nickname}</TableCell>
                  <TableCell>
                    <Badge variant="outline">Lvl {trader.level}</Badge>
                  </TableCell>
                  <TableCell className={trader.total_profit_loss >= 0 ? 'text-green-500' : 'text-red-500'}>
                    ${trader.total_profit_loss.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </TableCell>
                  <TableCell>{trader.total_trades}</TableCell>
                  <TableCell>{trader.win_rate.toFixed(1)}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modify Balance Dialog */}
      <Dialog open={showModifyBalanceDialog} onOpenChange={setShowModifyBalanceDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modify User Balance</DialogTitle>
            <DialogDescription>Add or remove virtual USDT from user account.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button 
                variant={modifyType === 'add' ? 'default' : 'outline'}
                onClick={() => setModifyType('add')}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
              <Button 
                variant={modifyType === 'remove' ? 'default' : 'outline'}
                onClick={() => setModifyType('remove')}
              >
                <Minus className="h-4 w-4 mr-1" />
                Remove
              </Button>
            </div>
            <div>
              <Label>Amount (USDT)</Label>
              <Input 
                type="number"
                value={modifyAmount}
                onChange={(e) => setModifyAmount(e.target.value)}
                placeholder="10000"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModifyBalanceDialog(false)}>Cancel</Button>
            <Button onClick={handleModifyBalance}>Apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modify Level Dialog */}
      <Dialog open={showModifyLevelDialog} onOpenChange={setShowModifyLevelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modify User Level</DialogTitle>
            <DialogDescription>Increase or decrease user level.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button 
                variant={modifyType === 'add' ? 'default' : 'outline'}
                onClick={() => setModifyType('add')}
              >
                <Plus className="h-4 w-4 mr-1" />
                Increase
              </Button>
              <Button 
                variant={modifyType === 'remove' ? 'default' : 'outline'}
                onClick={() => setModifyType('remove')}
              >
                <Minus className="h-4 w-4 mr-1" />
                Decrease
              </Button>
            </div>
            <div>
              <Label>Levels</Label>
              <Input 
                type="number"
                value={modifyAmount}
                onChange={(e) => setModifyAmount(e.target.value)}
                placeholder="1"
                min="1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModifyLevelDialog(false)}>Cancel</Button>
            <Button onClick={handleModifyLevel}>Apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modify Dividend Dialog */}
      <Dialog open={showDividendDialog} onOpenChange={setShowDividendDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modify Dividend Yield</DialogTitle>
            <DialogDescription>
              Adjust annual dividend yield for {selectedStock?.symbol}. Dividends are paid daily at 10:00 UTC.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Annual Dividend Yield: {dividendYield.toFixed(1)}%</Label>
              <Slider
                value={[dividendYield]}
                onValueChange={(value) => setDividendYield(value[0])}
                min={0}
                max={15}
                step={0.1}
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Daily payout: ~{(dividendYield / 365).toFixed(4)}% per day
              </p>
            </div>
            <div className="flex gap-2">
              <Button 
                size="sm" 
                variant={dividendYield === 0 ? 'default' : 'outline'}
                onClick={() => setDividendYield(0)}
              >
                0% (No Div)
              </Button>
              <Button 
                size="sm" 
                variant={dividendYield === 4.8 ? 'default' : 'outline'}
                onClick={() => setDividendYield(4.8)}
              >
                4.8% (Default)
              </Button>
              <Button 
                size="sm" 
                variant={dividendYield === 8 ? 'default' : 'outline'}
                onClick={() => setDividendYield(8)}
              >
                8% (High)
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDividendDialog(false)}>Cancel</Button>
            <Button onClick={handleUpdateDividendYield}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
