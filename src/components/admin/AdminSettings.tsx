import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { 
  Settings, Key, Database, Server, Shield, Clock, Save
} from 'lucide-react';

interface SystemSettings {
  trading_hours: { enabled: boolean; start: string; end: string };
  cooldown_after_loss_percent: { enabled: boolean; threshold: number; duration_minutes: number };
  markets_enabled: { crypto: boolean; stocks: boolean; forex: boolean };
}

export const AdminSettings = () => {
  const [settings, setSettings] = useState<SystemSettings>({
    trading_hours: { enabled: false, start: '09:00', end: '17:00' },
    cooldown_after_loss_percent: { enabled: true, threshold: 20, duration_minutes: 30 },
    markets_enabled: { crypto: true, stocks: true, forex: true },
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('trading_settings')
        .select('*');

      if (data) {
        const newSettings = { ...settings };
        data.forEach(item => {
          const value = typeof item.setting_value === 'string' 
            ? JSON.parse(item.setting_value) 
            : item.setting_value;
          
          if (item.setting_key === 'trading_hours') {
            newSettings.trading_hours = value;
          } else if (item.setting_key === 'cooldown_after_loss_percent') {
            newSettings.cooldown_after_loss_percent = value;
          } else if (item.setting_key === 'markets_enabled') {
            newSettings.markets_enabled = value;
          }
        });
        setSettings(newSettings);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('Failed to fetch settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async (key: string, value: any) => {
    setSaving(true);
    try {
      await supabase
        .from('trading_settings')
        .update({ setting_value: value })
        .eq('setting_key', key);

      await supabase.rpc('log_admin_action', {
        p_action_type: 'update_system_setting',
        p_entity_type: 'settings',
        p_entity_id: key,
        p_details: value
      });

      toast.success('Settings saved');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
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
      <Tabs defaultValue="trading" className="w-full">
        <TabsList>
          <TabsTrigger value="trading">Trading</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
        </TabsList>

        <TabsContent value="trading" className="space-y-6">
          {/* Trading Hours */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Trading Hours
              </CardTitle>
              <CardDescription>
                Restrict trading to specific hours of the day
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Enable Trading Hours Restriction</Label>
                <Switch 
                  checked={settings.trading_hours.enabled}
                  onCheckedChange={(v) => {
                    const newValue = { ...settings.trading_hours, enabled: v };
                    setSettings({ ...settings, trading_hours: newValue });
                  }}
                />
              </div>
              {settings.trading_hours.enabled && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Start Time</Label>
                    <Input 
                      type="time"
                      value={settings.trading_hours.start}
                      onChange={(e) => {
                        const newValue = { ...settings.trading_hours, start: e.target.value };
                        setSettings({ ...settings, trading_hours: newValue });
                      }}
                    />
                  </div>
                  <div>
                    <Label>End Time</Label>
                    <Input 
                      type="time"
                      value={settings.trading_hours.end}
                      onChange={(e) => {
                        const newValue = { ...settings.trading_hours, end: e.target.value };
                        setSettings({ ...settings, trading_hours: newValue });
                      }}
                    />
                  </div>
                </div>
              )}
              <Button 
                onClick={() => handleSaveSettings('trading_hours', settings.trading_hours)}
                disabled={saving}
              >
                <Save className="h-4 w-4 mr-2" />
                Save Trading Hours
              </Button>
            </CardContent>
          </Card>

          {/* Loss Cooldown */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Loss Cooldown (Anti-Abuse)
              </CardTitle>
              <CardDescription>
                Temporarily restrict trading after significant losses
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Enable Loss Cooldown</Label>
                <Switch 
                  checked={settings.cooldown_after_loss_percent.enabled}
                  onCheckedChange={(v) => {
                    const newValue = { ...settings.cooldown_after_loss_percent, enabled: v };
                    setSettings({ ...settings, cooldown_after_loss_percent: newValue });
                  }}
                />
              </div>
              {settings.cooldown_after_loss_percent.enabled && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Loss Threshold (%)</Label>
                    <Input 
                      type="number"
                      value={settings.cooldown_after_loss_percent.threshold}
                      onChange={(e) => {
                        const newValue = { ...settings.cooldown_after_loss_percent, threshold: parseInt(e.target.value) || 0 };
                        setSettings({ ...settings, cooldown_after_loss_percent: newValue });
                      }}
                    />
                  </div>
                  <div>
                    <Label>Cooldown Duration (minutes)</Label>
                    <Input 
                      type="number"
                      value={settings.cooldown_after_loss_percent.duration_minutes}
                      onChange={(e) => {
                        const newValue = { ...settings.cooldown_after_loss_percent, duration_minutes: parseInt(e.target.value) || 0 };
                        setSettings({ ...settings, cooldown_after_loss_percent: newValue });
                      }}
                    />
                  </div>
                </div>
              )}
              <Button 
                onClick={() => handleSaveSettings('cooldown_after_loss_percent', settings.cooldown_after_loss_percent)}
                disabled={saving}
              >
                <Save className="h-4 w-4 mr-2" />
                Save Cooldown Settings
              </Button>
            </CardContent>
          </Card>

          {/* Markets */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Market Controls
              </CardTitle>
              <CardDescription>
                Enable or disable entire market categories
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                  <Label>Crypto</Label>
                  <Switch 
                    checked={settings.markets_enabled.crypto}
                    onCheckedChange={(v) => {
                      const newValue = { ...settings.markets_enabled, crypto: v };
                      setSettings({ ...settings, markets_enabled: newValue });
                    }}
                  />
                </div>
                <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                  <Label>Stocks</Label>
                  <Switch 
                    checked={settings.markets_enabled.stocks}
                    onCheckedChange={(v) => {
                      const newValue = { ...settings.markets_enabled, stocks: v };
                      setSettings({ ...settings, markets_enabled: newValue });
                    }}
                  />
                </div>
                <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                  <Label>Forex</Label>
                  <Switch 
                    checked={settings.markets_enabled.forex}
                    onCheckedChange={(v) => {
                      const newValue = { ...settings.markets_enabled, forex: v };
                      setSettings({ ...settings, markets_enabled: newValue });
                    }}
                  />
                </div>
              </div>
              <Button 
                onClick={() => handleSaveSettings('markets_enabled', settings.markets_enabled)}
                disabled={saving}
              >
                <Save className="h-4 w-4 mr-2" />
                Save Market Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Security Settings
              </CardTitle>
              <CardDescription>
                Configure security and access control settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted/30 rounded-lg">
                <h4 className="font-medium mb-2">Row Level Security (RLS)</h4>
                <p className="text-sm text-muted-foreground">
                  All tables have RLS enabled. Users can only access their own data.
                </p>
              </div>
              <div className="p-4 bg-muted/30 rounded-lg">
                <h4 className="font-medium mb-2">Admin Role System</h4>
                <p className="text-sm text-muted-foreground">
                  Admin roles are stored in a separate user_roles table and validated server-side.
                </p>
              </div>
              <div className="p-4 bg-muted/30 rounded-lg">
                <h4 className="font-medium mb-2">Audit Logging</h4>
                <p className="text-sm text-muted-foreground">
                  All admin actions are logged to the audit_logs table for accountability.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                System Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-muted/30 rounded-lg">
                  <p className="text-sm text-muted-foreground">Database</p>
                  <p className="font-medium">Supabase PostgreSQL</p>
                </div>
                <div className="p-4 bg-muted/30 rounded-lg">
                  <p className="text-sm text-muted-foreground">Backend</p>
                  <p className="font-medium">Edge Functions (Deno)</p>
                </div>
                <div className="p-4 bg-muted/30 rounded-lg">
                  <p className="text-sm text-muted-foreground">Authentication</p>
                  <p className="font-medium">Supabase Auth</p>
                </div>
                <div className="p-4 bg-muted/30 rounded-lg">
                  <p className="text-sm text-muted-foreground">Real-time</p>
                  <p className="font-medium">Supabase Realtime</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                API Keys & Secrets
              </CardTitle>
              <CardDescription>
                Manage external API integrations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                API keys are managed through Supabase Secrets and are not displayed here for security reasons.
                To update API keys, use the Supabase dashboard or contact the system administrator.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
