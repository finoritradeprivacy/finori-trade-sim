import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { 
  Search, UserX, Shield, RefreshCw, Ban, Trash2, Eye, Download, 
  Clock, MapPin, Monitor
} from 'lucide-react';
import { format } from 'date-fns';

interface User {
  id: string;
  nickname: string;
  email: string;
  created_at: string;
  last_active_at: string | null;
  total_trades: number | null;
  total_profit_loss: number | null;
  win_rate: number | null;
  usdt_balance: number;
  level: number;
  total_xp: number;
  is_admin: boolean;
  is_banned: boolean;
}

interface UserSession {
  id: string;
  ip_address: string;
  user_agent: string;
  device_type: string;
  location: string;
  logged_in_at: string;
  is_active: boolean;
}

export const AdminUsers = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showUserDetail, setShowUserDetail] = useState(false);
  const [showBanDialog, setShowBanDialog] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [userSessions, setUserSessions] = useState<UserSession[]>([]);
  const [banReason, setBanReason] = useState('');
  const [banType, setBanType] = useState<'temporary' | 'permanent'>('temporary');
  const [banDuration, setBanDuration] = useState('7');
  const [newRole, setNewRole] = useState<'user' | 'moderator' | 'admin'>('user');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // Fetch users with all related data
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch balances
      const { data: balancesData } = await supabase.from('user_balances').select('*');
      const balanceMap = new Map(balancesData?.map(b => [b.user_id, b.usdt_balance]) || []);

      // Fetch player stats
      const { data: statsData } = await supabase.from('player_stats').select('*');
      const statsMap = new Map(statsData?.map(s => [s.user_id, s]) || []);

      // Fetch admin roles
      const { data: rolesData } = await supabase.from('user_roles').select('*');
      const adminSet = new Set(rolesData?.filter(r => r.role === 'admin').map(r => r.user_id) || []);

      // Fetch bans
      const { data: bansData } = await supabase
        .from('user_bans')
        .select('*')
        .eq('is_active', true);
      const bannedSet = new Set(bansData?.map(b => b.user_id) || []);

      const users: User[] = profilesData?.map(p => ({
        id: p.id,
        nickname: p.nickname,
        email: p.email,
        created_at: p.created_at,
        last_active_at: p.last_active_at,
        total_trades: p.total_trades,
        total_profit_loss: p.total_profit_loss,
        win_rate: p.win_rate,
        usdt_balance: balanceMap.get(p.id) || 0,
        level: statsMap.get(p.id)?.level || 1,
        total_xp: statsMap.get(p.id)?.total_xp || 0,
        is_admin: adminSet.has(p.id),
        is_banned: bannedSet.has(p.id),
      })) || [];

      setUsers(users);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserSessions = async (userId: string) => {
    const { data } = await supabase
      .from('user_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('logged_in_at', { ascending: false })
      .limit(10);
    setUserSessions(data || []);
  };

  const handleViewUser = async (user: User) => {
    setSelectedUser(user);
    await fetchUserSessions(user.id);
    setShowUserDetail(true);
  };

  const handleBanUser = async () => {
    if (!selectedUser || !banReason) return;

    try {
      const expiresAt = banType === 'permanent' 
        ? null 
        : new Date(Date.now() + parseInt(banDuration) * 24 * 60 * 60 * 1000).toISOString();

      const { error } = await supabase.from('user_bans').insert({
        user_id: selectedUser.id,
        ban_type: banType,
        reason: banReason,
        expires_at: expiresAt,
      });

      if (error) throw error;

      // Log admin action
      await supabase.rpc('log_admin_action', {
        p_action_type: 'ban_user',
        p_entity_type: 'user',
        p_entity_id: selectedUser.id,
        p_details: { ban_type: banType, reason: banReason, duration: banDuration }
      });

      toast.success(`User ${selectedUser.nickname} has been banned`);
      setShowBanDialog(false);
      setBanReason('');
      fetchUsers();
    } catch (error) {
      console.error('Error banning user:', error);
      toast.error('Failed to ban user');
    }
  };

  const handleUnbanUser = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('user_bans')
        .update({ is_active: false })
        .eq('user_id', userId)
        .eq('is_active', true);

      if (error) throw error;

      await supabase.rpc('log_admin_action', {
        p_action_type: 'unban_user',
        p_entity_type: 'user',
        p_entity_id: userId,
      });

      toast.success('User has been unbanned');
      fetchUsers();
    } catch (error) {
      console.error('Error unbanning user:', error);
      toast.error('Failed to unban user');
    }
  };

  const handleResetAccount = async () => {
    if (!selectedUser) return;

    try {
      // Reset balance
      await supabase
        .from('user_balances')
        .update({ usdt_balance: 100000, locked_balance: 0 })
        .eq('user_id', selectedUser.id);

      // Reset stats
      await supabase
        .from('profiles')
        .update({ total_trades: 0, total_profit_loss: 0, win_rate: 0 })
        .eq('id', selectedUser.id);

      // Reset player stats
      await supabase
        .from('player_stats')
        .update({ total_xp: 0, level: 1 })
        .eq('user_id', selectedUser.id);

      // Delete portfolios
      await supabase.from('portfolios').delete().eq('user_id', selectedUser.id);

      // Delete orders
      await supabase.from('orders').delete().eq('user_id', selectedUser.id);

      // Delete trades
      await supabase.from('trades').delete().eq('user_id', selectedUser.id);

      await supabase.rpc('log_admin_action', {
        p_action_type: 'reset_account',
        p_entity_type: 'user',
        p_entity_id: selectedUser.id,
      });

      toast.success(`Account ${selectedUser.nickname} has been reset`);
      setShowResetDialog(false);
      fetchUsers();
    } catch (error) {
      console.error('Error resetting account:', error);
      toast.error('Failed to reset account');
    }
  };

  const handleChangeRole = async () => {
    if (!selectedUser) return;

    try {
      // Remove existing role
      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', selectedUser.id);

      // Add new role if not 'user'
      if (newRole !== 'user') {
        await supabase.from('user_roles').insert({
          user_id: selectedUser.id,
          role: newRole,
        });
      }

      await supabase.rpc('log_admin_action', {
        p_action_type: 'change_role',
        p_entity_type: 'user',
        p_entity_id: selectedUser.id,
        p_details: { new_role: newRole }
      });

      toast.success(`Role changed to ${newRole}`);
      setShowRoleDialog(false);
      fetchUsers();
    } catch (error) {
      console.error('Error changing role:', error);
      toast.error('Failed to change role');
    }
  };

  const handleExportUserData = async (user: User) => {
    try {
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      const { data: balance } = await supabase.from('user_balances').select('*').eq('user_id', user.id).single();
      const { data: stats } = await supabase.from('player_stats').select('*').eq('user_id', user.id).single();
      const { data: portfolios } = await supabase.from('portfolios').select('*').eq('user_id', user.id);
      const { data: orders } = await supabase.from('orders').select('*').eq('user_id', user.id);
      const { data: trades } = await supabase.from('trades').select('*').eq('user_id', user.id);
      const { data: sessions } = await supabase.from('user_sessions').select('*').eq('user_id', user.id);

      const exportData = {
        profile,
        balance,
        stats,
        portfolios,
        orders,
        trades,
        sessions,
        exported_at: new Date().toISOString(),
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `user_${user.nickname}_data.json`;
      a.click();

      await supabase.rpc('log_admin_action', {
        p_action_type: 'export_user_data',
        p_entity_type: 'user',
        p_entity_id: user.id,
      });

      toast.success('User data exported (GDPR)');
    } catch (error) {
      console.error('Error exporting user data:', error);
      toast.error('Failed to export user data');
    }
  };

  const filteredUsers = users.filter(u =>
    u.nickname.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by nickname or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={fetchUsers} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Users ({filteredUsers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead>Trades</TableHead>
                    <TableHead>P/L</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{user.nickname}</p>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono">
                        ${user.usdt_balance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">Lvl {user.level}</Badge>
                      </TableCell>
                      <TableCell>{user.total_trades || 0}</TableCell>
                      <TableCell className={user.total_profit_loss && user.total_profit_loss >= 0 ? 'text-green-500' : 'text-red-500'}>
                        ${(user.total_profit_loss || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {user.is_admin && <Badge className="bg-purple-500">Admin</Badge>}
                          {user.is_banned && <Badge variant="destructive">Banned</Badge>}
                          {!user.is_admin && !user.is_banned && <Badge variant="secondary">User</Badge>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => handleViewUser(user)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => { setSelectedUser(user); setShowRoleDialog(true); }}>
                            <Shield className="h-4 w-4" />
                          </Button>
                          {user.is_banned ? (
                            <Button size="sm" variant="ghost" onClick={() => handleUnbanUser(user.id)}>
                              <UserX className="h-4 w-4 text-green-500" />
                            </Button>
                          ) : (
                            <Button size="sm" variant="ghost" onClick={() => { setSelectedUser(user); setShowBanDialog(true); }}>
                              <Ban className="h-4 w-4 text-red-500" />
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => { setSelectedUser(user); setShowResetDialog(true); }}>
                            <RefreshCw className="h-4 w-4 text-yellow-500" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleExportUserData(user)}>
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* User Detail Dialog */}
      <Dialog open={showUserDetail} onOpenChange={setShowUserDetail}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>User Details: {selectedUser?.nickname}</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{selectedUser.email}</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">Joined</p>
                  <p className="font-medium">{format(new Date(selectedUser.created_at), 'PPP')}</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">Balance</p>
                  <p className="font-medium font-mono">${selectedUser.usdt_balance.toLocaleString()}</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">Level / XP</p>
                  <p className="font-medium">Level {selectedUser.level} ({selectedUser.total_xp} XP)</p>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Login History
                </h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {userSessions.map((session) => (
                    <div key={session.id} className="flex items-center justify-between p-2 bg-muted/30 rounded text-sm">
                      <div className="flex items-center gap-4">
                        <span className="font-mono">{session.ip_address || 'Unknown IP'}</span>
                        <span className="text-muted-foreground">{session.device_type || 'Unknown device'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">
                          {format(new Date(session.logged_in_at), 'PPp')}
                        </span>
                        {session.is_active && <Badge variant="outline" className="text-green-500">Active</Badge>}
                      </div>
                    </div>
                  ))}
                  {userSessions.length === 0 && (
                    <p className="text-muted-foreground text-center py-4">No login history</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Ban Dialog */}
      <Dialog open={showBanDialog} onOpenChange={setShowBanDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ban User: {selectedUser?.nickname}</DialogTitle>
            <DialogDescription>This will prevent the user from accessing the platform.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Ban Type</label>
              <Select value={banType} onValueChange={(v) => setBanType(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="temporary">Temporary</SelectItem>
                  <SelectItem value="permanent">Permanent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {banType === 'temporary' && (
              <div>
                <label className="text-sm font-medium">Duration (days)</label>
                <Input 
                  type="number" 
                  value={banDuration} 
                  onChange={(e) => setBanDuration(e.target.value)}
                  min="1"
                />
              </div>
            )}
            <div>
              <label className="text-sm font-medium">Reason</label>
              <Textarea 
                value={banReason} 
                onChange={(e) => setBanReason(e.target.value)}
                placeholder="Enter ban reason..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBanDialog(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleBanUser} disabled={!banReason}>
              Ban User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Dialog */}
      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Account: {selectedUser?.nickname}</DialogTitle>
            <DialogDescription>
              This will reset the user's balance to $100,000, clear all trades, portfolios, and stats.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResetDialog(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleResetAccount}>
              Reset Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Role Dialog */}
      <Dialog open={showRoleDialog} onOpenChange={setShowRoleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Role: {selectedUser?.nickname}</DialogTitle>
          </DialogHeader>
          <div>
            <label className="text-sm font-medium">New Role</label>
            <Select value={newRole} onValueChange={(v) => setNewRole(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="moderator">Moderator</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRoleDialog(false)}>Cancel</Button>
            <Button onClick={handleChangeRole}>Save Role</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
