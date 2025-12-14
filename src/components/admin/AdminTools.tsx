import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { 
  Bug, UserCog, TestTube, Zap, TrendingUp, TrendingDown, 
  RefreshCw, Play, AlertTriangle, Database
} from 'lucide-react';

export const AdminTools = () => {
  const { user } = useAuth();
  const [testUserEmail, setTestUserEmail] = useState('');
  const [testUserNickname, setTestUserNickname] = useState('');
  const [volatilityMultiplier, setVolatilityMultiplier] = useState('2');
  const [isSimulatingVolatility, setIsSimulatingVolatility] = useState(false);
  const [isCreatingTestUser, setIsCreatingTestUser] = useState(false);

  const handleCreateTestUser = async () => {
    if (!testUserEmail || !testUserNickname) {
      toast.error('Please fill in all fields');
      return;
    }

    setIsCreatingTestUser(true);
    try {
      // Create test user with known password
      const { data, error } = await supabase.auth.signUp({
        email: testUserEmail,
        password: 'TestUser123!',
        options: {
          data: {
            nickname: testUserNickname,
          }
        }
      });

      if (error) throw error;

      await supabase.rpc('log_admin_action', {
        p_action_type: 'create_test_user',
        p_entity_type: 'user',
        p_entity_id: data.user?.id,
        p_details: { email: testUserEmail, nickname: testUserNickname }
      });

      toast.success(`Test user created: ${testUserEmail} / TestUser123!`);
      setTestUserEmail('');
      setTestUserNickname('');
    } catch (error: any) {
      console.error('Error creating test user:', error);
      toast.error(error.message || 'Failed to create test user');
    } finally {
      setIsCreatingTestUser(false);
    }
  };

  const handleSimulateVolatility = async () => {
    setIsSimulatingVolatility(true);
    try {
      const multiplier = parseFloat(volatilityMultiplier);
      
      // Get all assets
      const { data: assets } = await supabase
        .from('assets')
        .select('id, current_price')
        .eq('is_active', true);

      if (!assets) throw new Error('No assets found');

      // Apply random price changes with increased volatility
      for (const asset of assets) {
        const changePercent = (Math.random() - 0.5) * 2 * multiplier * 5; // ±5% * multiplier
        const newPrice = asset.current_price * (1 + changePercent / 100);
        
        await supabase
          .from('assets')
          .update({ current_price: Math.max(0.01, newPrice) })
          .eq('id', asset.id);
      }

      await supabase.rpc('log_admin_action', {
        p_action_type: 'simulate_volatility',
        p_entity_type: 'market',
        p_details: { multiplier, affected_assets: assets.length }
      });

      toast.success(`Volatility simulation applied (${multiplier}x)`);
    } catch (error) {
      console.error('Error simulating volatility:', error);
      toast.error('Failed to simulate volatility');
    } finally {
      setIsSimulatingVolatility(false);
    }
  };

  const handleSimulateMarketCrash = async () => {
    try {
      const { data: assets } = await supabase
        .from('assets')
        .select('id, current_price')
        .eq('is_active', true);

      if (!assets) throw new Error('No assets found');

      // Drop all prices by 10-30%
      for (const asset of assets) {
        const dropPercent = 10 + Math.random() * 20;
        const newPrice = asset.current_price * (1 - dropPercent / 100);
        
        await supabase
          .from('assets')
          .update({ current_price: Math.max(0.01, newPrice) })
          .eq('id', asset.id);
      }

      // Create admin notification
      await supabase.rpc('create_admin_notification', {
        p_type: 'market_simulation',
        p_title: 'Market Crash Simulated',
        p_message: `All asset prices dropped by 10-30%`,
        p_severity: 'warning'
      });

      await supabase.rpc('log_admin_action', {
        p_action_type: 'simulate_market_crash',
        p_entity_type: 'market',
        p_details: { affected_assets: assets.length }
      });

      toast.success('Market crash simulated');
    } catch (error) {
      console.error('Error simulating market crash:', error);
      toast.error('Failed to simulate market crash');
    }
  };

  const handleSimulateMarketRally = async () => {
    try {
      const { data: assets } = await supabase
        .from('assets')
        .select('id, current_price')
        .eq('is_active', true);

      if (!assets) throw new Error('No assets found');

      // Increase all prices by 10-30%
      for (const asset of assets) {
        const risePercent = 10 + Math.random() * 20;
        const newPrice = asset.current_price * (1 + risePercent / 100);
        
        await supabase
          .from('assets')
          .update({ current_price: newPrice })
          .eq('id', asset.id);
      }

      await supabase.rpc('create_admin_notification', {
        p_type: 'market_simulation',
        p_title: 'Market Rally Simulated',
        p_message: `All asset prices increased by 10-30%`,
        p_severity: 'info'
      });

      await supabase.rpc('log_admin_action', {
        p_action_type: 'simulate_market_rally',
        p_entity_type: 'market',
        p_details: { affected_assets: assets.length }
      });

      toast.success('Market rally simulated');
    } catch (error) {
      console.error('Error simulating market rally:', error);
      toast.error('Failed to simulate market rally');
    }
  };

  const handleResetAllPrices = async () => {
    try {
      // Reset to base prices
      const basePrices: Record<string, number> = {
        'BTC': 45000,
        'ETH': 2500,
        'SOL': 100,
        'DOGE': 0.08,
        'XRP': 0.55,
        'AAPL': 175,
        'GOOGL': 140,
        'MSFT': 380,
        'TSLA': 250,
        'AMZN': 155,
        'EUR/USD': 1.09,
        'GBP/USD': 1.27,
        'USD/JPY': 149,
        'AUD/USD': 0.65,
        'USD/CAD': 1.36,
      };

      const { data: assets } = await supabase.from('assets').select('id, symbol');

      for (const asset of assets || []) {
        const basePrice = basePrices[asset.symbol];
        if (basePrice) {
          await supabase
            .from('assets')
            .update({ current_price: basePrice })
            .eq('id', asset.id);
        }
      }

      await supabase.rpc('log_admin_action', {
        p_action_type: 'reset_prices',
        p_entity_type: 'market',
      });

      toast.success('All prices reset to base values');
    } catch (error) {
      console.error('Error resetting prices:', error);
      toast.error('Failed to reset prices');
    }
  };

  const handleTriggerPriceUpdate = async () => {
    try {
      const response = await supabase.functions.invoke('update-asset-prices');
      
      if (response.error) throw response.error;

      toast.success('Price update triggered');
    } catch (error) {
      console.error('Error triggering price update:', error);
      toast.error('Failed to trigger price update');
    }
  };

  const [isGeneratingNews, setIsGeneratingNews] = useState(false);
  const [isGeneratingHistory, setIsGeneratingHistory] = useState(false);

  const handleTriggerNewsGeneration = async () => {
    setIsGeneratingNews(true);
    try {
      const response = await supabase.functions.invoke('generate-news');
      
      if (response.error) throw response.error;

      const data = response.data;
      if (data?.generated) {
        toast.success(`Generated ${data.generated} news events`);
      } else if (data?.message) {
        toast.info(data.message);
      } else {
        toast.success('News generation triggered');
      }

      await supabase.rpc('log_admin_action', {
        p_action_type: 'trigger_news_generation',
        p_entity_type: 'news',
        p_details: { generated: data?.generated || 0 }
      });
    } catch (error: any) {
      console.error('Error triggering news generation:', error);
      toast.error(error.message || 'Failed to trigger news generation');
    } finally {
      setIsGeneratingNews(false);
    }
  };

  const handleGeneratePriceHistory = async () => {
    setIsGeneratingHistory(true);
    toast.info('Generating 4 months of price history for all assets... This may take several minutes.');
    try {
      const response = await supabase.functions.invoke('generate-price-history');
      
      if (response.error) throw response.error;

      toast.success(response.data?.message || 'Price history generation complete!');

      await supabase.rpc('log_admin_action', {
        p_action_type: 'generate_price_history',
        p_entity_type: 'market',
        p_details: { success: true }
      });
    } catch (error: any) {
      console.error('Error generating price history:', error);
      toast.error(error.message || 'Failed to generate price history (may still be running in background)');
    } finally {
      setIsGeneratingHistory(false);
    }
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="testing" className="w-full">
        <TabsList>
          <TabsTrigger value="testing">Testing Tools</TabsTrigger>
          <TabsTrigger value="simulation">Market Simulation</TabsTrigger>
          <TabsTrigger value="triggers">Manual Triggers</TabsTrigger>
        </TabsList>

        <TabsContent value="testing" className="space-y-6">
          {/* Create Test User */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCog className="h-5 w-5" />
                Create Test User
              </CardTitle>
              <CardDescription>
                Create a new test user with a known password for testing
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Email</Label>
                  <Input 
                    type="email"
                    value={testUserEmail}
                    onChange={(e) => setTestUserEmail(e.target.value)}
                    placeholder="test@example.com"
                  />
                </div>
                <div>
                  <Label>Nickname</Label>
                  <Input 
                    value={testUserNickname}
                    onChange={(e) => setTestUserNickname(e.target.value)}
                    placeholder="TestPlayer"
                  />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Password will be: <code className="bg-muted px-2 py-1 rounded">TestUser123!</code>
              </p>
              <Button 
                onClick={handleCreateTestUser}
                disabled={isCreatingTestUser}
              >
                <TestTube className="h-4 w-4 mr-2" />
                {isCreatingTestUser ? 'Creating...' : 'Create Test User'}
              </Button>
            </CardContent>
          </Card>

          {/* Debug Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bug className="h-5 w-5" />
                Debug Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted/30 rounded-lg font-mono text-sm">
                <p>Current User ID: {user?.id}</p>
                <p>Email: {user?.email}</p>
                <p>Session: Active</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="simulation" className="space-y-6">
          {/* Volatility Simulation */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Volatility Simulation
              </CardTitle>
              <CardDescription>
                Temporarily increase market volatility for testing
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div>
                  <Label>Volatility Multiplier</Label>
                  <Input 
                    type="number"
                    value={volatilityMultiplier}
                    onChange={(e) => setVolatilityMultiplier(e.target.value)}
                    min="1"
                    max="10"
                    className="w-24"
                  />
                </div>
                <Button 
                  onClick={handleSimulateVolatility}
                  disabled={isSimulatingVolatility}
                >
                  <Zap className="h-4 w-4 mr-2" />
                  {isSimulatingVolatility ? 'Simulating...' : 'Apply Volatility'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Market Events */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Market Event Simulation
              </CardTitle>
              <CardDescription>
                Simulate extreme market events
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <Button 
                  variant="destructive"
                  onClick={handleSimulateMarketCrash}
                >
                  <TrendingDown className="h-4 w-4 mr-2" />
                  Simulate Crash
                </Button>
                <Button 
                  className="bg-green-600 hover:bg-green-700"
                  onClick={handleSimulateMarketRally}
                >
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Simulate Rally
                </Button>
                <Button 
                  variant="outline"
                  onClick={handleResetAllPrices}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Reset Prices
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="triggers" className="space-y-6">
          {/* Manual Triggers */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Play className="h-5 w-5" />
                Manual Function Triggers
              </CardTitle>
              <CardDescription>
                Manually trigger background functions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Button 
                  variant="outline"
                  onClick={handleTriggerPriceUpdate}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Trigger Price Update
                </Button>
                <Button 
                  variant="outline"
                  onClick={handleTriggerNewsGeneration}
                  disabled={isGeneratingNews}
                >
                  <Zap className={`h-4 w-4 mr-2 ${isGeneratingNews ? 'animate-spin' : ''}`} />
                  {isGeneratingNews ? 'Generating...' : 'Generate Market News'}
                </Button>
                <Button 
                  variant="outline"
                  onClick={handleGeneratePriceHistory}
                  disabled={isGeneratingHistory}
                  className="col-span-2"
                >
                  <Database className={`h-4 w-4 mr-2 ${isGeneratingHistory ? 'animate-spin' : ''}`} />
                  {isGeneratingHistory ? 'Generating 4-month history...' : 'Generate 4-Month Price History'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
