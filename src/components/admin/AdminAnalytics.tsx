import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  BarChart, LineChart, PieChart as PieChartIcon,
  TrendingUp, Users, Activity, Clock
} from 'lucide-react';
import { format, subDays, eachDayOfInterval } from 'date-fns';
import { 
  ResponsiveContainer, LineChart as RechartsLineChart, Line, 
  XAxis, YAxis, CartesianGrid, Tooltip, BarChart as RechartsBarChart,
  Bar, PieChart, Pie, Cell
} from 'recharts';

interface AnalyticsData {
  dailySignups: { date: string; count: number }[];
  dailyTrades: { date: string; count: number }[];
  marketDistribution: { name: string; value: number }[];
  userRetention: { period: string; rate: number }[];
  topErrors: { error: string; count: number }[];
  engagementMetrics: {
    avgSessionDuration: number;
    avgTradesPerUser: number;
    activeUserRate: number;
  };
}

const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

export const AdminAnalytics = () => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const last30Days = subDays(now, 30);
      
      // Daily signups
      const { data: signupsData } = await supabase
        .from('profiles')
        .select('created_at')
        .gte('created_at', last30Days.toISOString());

      const signupsByDay: Record<string, number> = {};
      eachDayOfInterval({ start: last30Days, end: now }).forEach(day => {
        signupsByDay[format(day, 'MMM d')] = 0;
      });
      
      signupsData?.forEach(profile => {
        const day = format(new Date(profile.created_at), 'MMM d');
        if (signupsByDay[day] !== undefined) {
          signupsByDay[day]++;
        }
      });

      const dailySignups = Object.entries(signupsByDay).map(([date, count]) => ({ date, count }));

      // Daily trades
      const { data: tradesData } = await supabase
        .from('trades')
        .select('created_at')
        .gte('created_at', last30Days.toISOString());

      const tradesByDay: Record<string, number> = {};
      eachDayOfInterval({ start: last30Days, end: now }).forEach(day => {
        tradesByDay[format(day, 'MMM d')] = 0;
      });
      
      tradesData?.forEach(trade => {
        const day = format(new Date(trade.created_at), 'MMM d');
        if (tradesByDay[day] !== undefined) {
          tradesByDay[day]++;
        }
      });

      const dailyTrades = Object.entries(tradesByDay).map(([date, count]) => ({ date, count }));

      // Market distribution
      const { data: assetsTraded } = await supabase
        .from('trades')
        .select('assets!inner(category)');

      const marketCounts: Record<string, number> = { crypto: 0, stocks: 0, forex: 0 };
      assetsTraded?.forEach((t: any) => {
        const cat = t.assets?.category || 'other';
        if (marketCounts[cat] !== undefined) {
          marketCounts[cat]++;
        }
      });

      const marketDistribution = Object.entries(marketCounts).map(([name, value]) => ({ 
        name: name.charAt(0).toUpperCase() + name.slice(1), 
        value 
      }));

      // User retention (simplified)
      const { count: totalUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      const { count: activeToday } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .gte('last_active_at', subDays(now, 1).toISOString());

      const { count: activeWeek } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .gte('last_active_at', subDays(now, 7).toISOString());

      const { count: activeMonth } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .gte('last_active_at', subDays(now, 30).toISOString());

      const userRetention = [
        { period: 'Day 1', rate: totalUsers ? Math.round((activeToday || 0) / totalUsers * 100) : 0 },
        { period: 'Day 7', rate: totalUsers ? Math.round((activeWeek || 0) / totalUsers * 100) : 0 },
        { period: 'Day 30', rate: totalUsers ? Math.round((activeMonth || 0) / totalUsers * 100) : 0 },
      ];

      // Engagement metrics
      const { data: profileStats } = await supabase
        .from('profiles')
        .select('played_time_seconds, total_trades');

      const avgSessionDuration = profileStats?.length 
        ? profileStats.reduce((sum, p) => sum + (p.played_time_seconds || 0), 0) / profileStats.length / 60
        : 0;

      const avgTradesPerUser = profileStats?.length
        ? profileStats.reduce((sum, p) => sum + (p.total_trades || 0), 0) / profileStats.length
        : 0;

      setData({
        dailySignups,
        dailyTrades,
        marketDistribution,
        userRetention,
        topErrors: [], // Would need error tracking system
        engagementMetrics: {
          avgSessionDuration: Math.round(avgSessionDuration),
          avgTradesPerUser: Math.round(avgTradesPerUser * 10) / 10,
          activeUserRate: totalUsers ? Math.round((activeWeek || 0) / totalUsers * 100) : 0,
        },
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
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
      {/* Engagement Metrics */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Avg Session Duration</p>
                <p className="text-2xl font-bold">{data?.engagementMetrics.avgSessionDuration} min</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Activity className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Avg Trades per User</p>
                <p className="text-2xl font-bold">{data?.engagementMetrics.avgTradesPerUser}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Weekly Active Rate</p>
                <p className="text-2xl font-bold">{data?.engagementMetrics.activeUserRate}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Daily Signups Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LineChart className="h-5 w-5" />
              Daily Signups (Last 30 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsLineChart data={data?.dailySignups}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip />
                  <Line 
                    type="monotone" 
                    dataKey="count" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={false}
                  />
                </RechartsLineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Daily Trades Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart className="h-5 w-5" />
              Daily Trades (Last 30 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsBarChart data={data?.dailyTrades}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </RechartsBarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Market Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChartIcon className="h-5 w-5" />
              Market Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data?.marketDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {data?.marketDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* User Retention */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              User Retention
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data?.userRetention.map((item, i) => (
                <div key={item.period} className="flex items-center justify-between">
                  <span className="text-sm font-medium">{item.period}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-48 h-3 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all"
                        style={{ 
                          width: `${item.rate}%`,
                          backgroundColor: COLORS[i]
                        }}
                      />
                    </div>
                    <span className="text-sm font-mono w-12 text-right">{item.rate}%</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 p-4 bg-muted/30 rounded-lg">
              <p className="text-sm text-muted-foreground">
                Retention rate shows the percentage of users who remain active after signing up.
                Higher rates indicate better user engagement.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
