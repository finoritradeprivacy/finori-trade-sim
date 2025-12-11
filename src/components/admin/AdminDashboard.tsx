import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Users, TrendingUp, DollarSign, Activity, AlertTriangle, 
  Server, BarChart3, Clock, Zap
} from 'lucide-react';
import { format, subDays, subHours } from 'date-fns';

interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  newUsers24h: number;
  newUsers7d: number;
  newUsers30d: number;
  totalTrades: number;
  totalVolume: number;
  avgDailyLogins: number;
  topMarkets: { category: string; count: number }[];
  largestPositions: { nickname: string; asset: string; value: number }[];
  suspiciousActivity: { type: string; count: number; severity: string }[];
  serverStatus: { name: string; status: 'online' | 'warning' | 'offline' }[];
}

export const AdminDashboard = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats();
    const interval = setInterval(fetchDashboardStats, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardStats = async () => {
    try {
      // Fetch total users
      const { count: totalUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      // New users in different periods
      const now = new Date();
      const { count: newUsers24h } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', subHours(now, 24).toISOString());

      const { count: newUsers7d } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', subDays(now, 7).toISOString());

      const { count: newUsers30d } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', subDays(now, 30).toISOString());

      // Active users (last 24h)
      const { count: activeUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .gte('last_active_at', subHours(now, 24).toISOString());

      // Total trades and volume
      const { data: tradesData } = await supabase
        .from('trades')
        .select('total_value');
      
      const totalTrades = tradesData?.length || 0;
      const totalVolume = tradesData?.reduce((sum, t) => sum + Number(t.total_value), 0) || 0;

      // Top markets by trade count
      const { data: marketsData } = await supabase
        .from('trades')
        .select('asset_id, assets!inner(category)')
        .limit(1000);

      const marketCounts: Record<string, number> = {};
      marketsData?.forEach((t: any) => {
        const cat = t.assets?.category || 'unknown';
        marketCounts[cat] = (marketCounts[cat] || 0) + 1;
      });

      const topMarkets = Object.entries(marketCounts)
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Largest open positions
      const { data: positionsData } = await supabase
        .from('portfolios')
        .select('quantity, average_buy_price, profiles!inner(nickname), assets!inner(symbol)')
        .gt('quantity', 0)
        .order('quantity', { ascending: false })
        .limit(5);

      const largestPositions = positionsData?.map((p: any) => ({
        nickname: p.profiles?.nickname || 'Unknown',
        asset: p.assets?.symbol || 'Unknown',
        value: Number(p.quantity) * Number(p.average_buy_price)
      })) || [];

      // Suspicious activity (rapid trades, multiple accounts from same IP)
      const { data: sessionsData } = await supabase
        .from('user_sessions')
        .select('ip_address, user_id')
        .gte('logged_in_at', subDays(now, 7).toISOString());

      const ipCounts: Record<string, Set<string>> = {};
      sessionsData?.forEach((s: any) => {
        if (s.ip_address) {
          if (!ipCounts[s.ip_address]) ipCounts[s.ip_address] = new Set();
          ipCounts[s.ip_address].add(s.user_id);
        }
      });

      const multiAccountIPs = Object.entries(ipCounts)
        .filter(([_, users]) => users.size > 1).length;

      const suspiciousActivity = [
        { type: 'Multi-account IPs', count: multiAccountIPs, severity: multiAccountIPs > 5 ? 'high' : 'medium' },
      ];

      // Server status (simulated for now)
      const serverStatus = [
        { name: 'Database', status: 'online' as const },
        { name: 'Edge Functions', status: 'online' as const },
        { name: 'Price Feed', status: 'online' as const },
        { name: 'News Generator', status: 'online' as const },
      ];

      setStats({
        totalUsers: totalUsers || 0,
        activeUsers: activeUsers || 0,
        newUsers24h: newUsers24h || 0,
        newUsers7d: newUsers7d || 0,
        newUsers30d: newUsers30d || 0,
        totalTrades,
        totalVolume,
        avgDailyLogins: Math.round((activeUsers || 0) / 7),
        topMarkets,
        largestPositions,
        suspiciousActivity,
        serverStatus,
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Total Users</p>
                <p className="text-2xl font-bold">{stats?.totalUsers.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Activity className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Active (24h)</p>
                <p className="text-2xl font-bold">{stats?.activeUsers.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Trades</p>
                <p className="text-2xl font-bold">{stats?.totalTrades.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <DollarSign className="h-8 w-8 text-yellow-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Volume</p>
                <p className="text-2xl font-bold">${(stats?.totalVolume || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* New Registrations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            New Registrations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-3xl font-bold text-primary">{stats?.newUsers24h}</p>
              <p className="text-sm text-muted-foreground">Last 24h</p>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-3xl font-bold text-primary">{stats?.newUsers7d}</p>
              <p className="text-sm text-muted-foreground">Last 7 days</p>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-3xl font-bold text-primary">{stats?.newUsers30d}</p>
              <p className="text-sm text-muted-foreground">Last 30 days</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Top Markets */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Most Active Markets
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats?.topMarkets.map((market, i) => (
                <div key={market.category} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">#{i + 1}</span>
                    <span className="font-medium capitalize">{market.category}</span>
                  </div>
                  <Badge variant="secondary">{market.count} trades</Badge>
                </div>
              ))}
              {stats?.topMarkets.length === 0 && (
                <p className="text-muted-foreground text-center py-4">No trades yet</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Largest Positions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Largest Open Positions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats?.largestPositions.map((pos, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">#{i + 1}</span>
                    <span className="font-medium">{pos.nickname}</span>
                    <Badge variant="outline">{pos.asset}</Badge>
                  </div>
                  <span className="font-mono">${pos.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </div>
              ))}
              {stats?.largestPositions.length === 0 && (
                <p className="text-muted-foreground text-center py-4">No open positions</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Suspicious Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Suspicious Activity Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats?.suspiciousActivity.map((activity, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <span>{activity.type}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{activity.count}</span>
                    <Badge variant={activity.severity === 'high' ? 'destructive' : 'secondary'}>
                      {activity.severity}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Server Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              System Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats?.serverStatus.map((server, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <span>{server.name}</span>
                  <Badge 
                    variant={server.status === 'online' ? 'default' : server.status === 'warning' ? 'secondary' : 'destructive'}
                    className={server.status === 'online' ? 'bg-green-500' : ''}
                  >
                    {server.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
