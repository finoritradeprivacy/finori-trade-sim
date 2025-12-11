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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { 
  FileText, Shield, Search, RefreshCw, Ban, Eye, Download
} from 'lucide-react';
import { format } from 'date-fns';

interface AuditLog {
  id: string;
  user_id: string;
  user_nickname?: string;
  action_type: string;
  entity_type: string;
  entity_id: string | null;
  details: any;
  ip_address: string | null;
  created_at: string;
}

interface BlockedIP {
  id: string;
  ip_address: string;
  reason: string | null;
  blocked_by_nickname?: string;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

export const AdminAudit = () => {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [blockedIPs, setBlockedIPs] = useState<BlockedIP[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [newBlockIP, setNewBlockIP] = useState('');
  const [newBlockReason, setNewBlockReason] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch audit logs
      const { data: logsData } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      // Get user nicknames
      const userIds = [...new Set(logsData?.map(l => l.user_id).filter(Boolean) || [])];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, nickname')
        .in('id', userIds);
      
      const nicknameMap = new Map(profilesData?.map(p => [p.id, p.nickname]) || []);

      const logs: AuditLog[] = logsData?.map(l => ({
        ...l,
        user_nickname: nicknameMap.get(l.user_id) || 'System',
      })) || [];
      setAuditLogs(logs);

      // Fetch blocked IPs
      const { data: ipsData } = await supabase
        .from('ip_blocklist')
        .select('*')
        .order('created_at', { ascending: false });

      // Get blocker nicknames
      const blockerIds = [...new Set(ipsData?.map(i => i.blocked_by).filter(Boolean) || [])];
      const { data: blockersData } = await supabase
        .from('profiles')
        .select('id, nickname')
        .in('id', blockerIds);
      
      const blockerMap = new Map(blockersData?.map(p => [p.id, p.nickname]) || []);

      const ips: BlockedIP[] = ipsData?.map(i => ({
        ...i,
        blocked_by_nickname: i.blocked_by ? blockerMap.get(i.blocked_by) : undefined,
      })) || [];
      setBlockedIPs(ips);
    } catch (error) {
      console.error('Error fetching audit data:', error);
      toast.error('Failed to fetch audit data');
    } finally {
      setLoading(false);
    }
  };

  const handleBlockIP = async () => {
    if (!newBlockIP) return;

    try {
      await supabase.from('ip_blocklist').insert({
        ip_address: newBlockIP,
        reason: newBlockReason || null,
      });

      await supabase.rpc('log_admin_action', {
        p_action_type: 'block_ip',
        p_entity_type: 'ip',
        p_entity_id: newBlockIP,
        p_details: { reason: newBlockReason }
      });

      toast.success(`IP ${newBlockIP} blocked`);
      setNewBlockIP('');
      setNewBlockReason('');
      fetchData();
    } catch (error) {
      console.error('Error blocking IP:', error);
      toast.error('Failed to block IP');
    }
  };

  const handleUnblockIP = async (ip: BlockedIP) => {
    try {
      await supabase
        .from('ip_blocklist')
        .update({ is_active: false })
        .eq('id', ip.id);

      await supabase.rpc('log_admin_action', {
        p_action_type: 'unblock_ip',
        p_entity_type: 'ip',
        p_entity_id: ip.ip_address,
      });

      toast.success(`IP ${ip.ip_address} unblocked`);
      fetchData();
    } catch (error) {
      console.error('Error unblocking IP:', error);
      toast.error('Failed to unblock IP');
    }
  };

  const handleExportLogs = () => {
    const exportData = auditLogs.map(log => ({
      ...log,
      details: JSON.stringify(log.details),
    }));

    const csv = [
      ['Timestamp', 'User', 'Action', 'Entity Type', 'Entity ID', 'Details', 'IP Address'].join(','),
      ...exportData.map(log => [
        log.created_at,
        log.user_nickname,
        log.action_type,
        log.entity_type,
        log.entity_id || '',
        `"${log.details}"`,
        log.ip_address || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit_logs_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();

    toast.success('Audit logs exported');
  };

  const uniqueActions = [...new Set(auditLogs.map(l => l.action_type))];

  const filteredLogs = auditLogs.filter(log => {
    const matchesSearch = 
      log.user_nickname?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.entity_type.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesAction = actionFilter === 'all' || log.action_type === actionFilter;

    return matchesSearch && matchesAction;
  });

  const getActionBadgeColor = (action: string) => {
    if (action.includes('delete') || action.includes('ban') || action.includes('block')) return 'destructive';
    if (action.includes('create') || action.includes('add')) return 'default';
    if (action.includes('update') || action.includes('modify')) return 'secondary';
    return 'outline';
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="logs" className="w-full">
        <TabsList>
          <TabsTrigger value="logs">Audit Logs</TabsTrigger>
          <TabsTrigger value="ips">IP Blocklist</TabsTrigger>
        </TabsList>

        <TabsContent value="logs" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search logs..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Select value={actionFilter} onValueChange={setActionFilter}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Filter by action" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Actions</SelectItem>
                    {uniqueActions.map(action => (
                      <SelectItem key={action} value={action}>{action}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={fetchData}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
                <Button variant="outline" onClick={handleExportLogs}>
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Logs Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Audit Logs ({filteredLogs.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Timestamp</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Entity</TableHead>
                        <TableHead>Details</TableHead>
                        <TableHead>IP</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                            {format(new Date(log.created_at), 'MMM d, HH:mm:ss')}
                          </TableCell>
                          <TableCell className="font-medium">{log.user_nickname}</TableCell>
                          <TableCell>
                            <Badge variant={getActionBadgeColor(log.action_type) as any}>
                              {log.action_type}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">
                              {log.entity_type}
                              {log.entity_id && (
                                <span className="text-muted-foreground ml-1">
                                  ({log.entity_id.substring(0, 8)}...)
                                </span>
                              )}
                            </span>
                          </TableCell>
                          <TableCell className="max-w-[200px]">
                            <span className="text-xs text-muted-foreground font-mono truncate block">
                              {JSON.stringify(log.details)}
                            </span>
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {log.ip_address || '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                      {filteredLogs.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                            No audit logs found
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ips" className="space-y-4">
          {/* Block IP Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Ban className="h-5 w-5" />
                Block IP Address
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <Input
                  placeholder="IP Address (e.g., 192.168.1.1)"
                  value={newBlockIP}
                  onChange={(e) => setNewBlockIP(e.target.value)}
                  className="flex-1"
                />
                <Input
                  placeholder="Reason (optional)"
                  value={newBlockReason}
                  onChange={(e) => setNewBlockReason(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={handleBlockIP} disabled={!newBlockIP}>
                  <Ban className="h-4 w-4 mr-2" />
                  Block
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Blocked IPs List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Blocked IP Addresses ({blockedIPs.filter(ip => ip.is_active).length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>IP Address</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Blocked By</TableHead>
                    <TableHead>Blocked At</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {blockedIPs.map((ip) => (
                    <TableRow key={ip.id}>
                      <TableCell className="font-mono">{ip.ip_address}</TableCell>
                      <TableCell>{ip.reason || '-'}</TableCell>
                      <TableCell>{ip.blocked_by_nickname || 'System'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(ip.created_at), 'MMM d, yyyy HH:mm')}
                      </TableCell>
                      <TableCell>
                        <Badge variant={ip.is_active ? 'destructive' : 'secondary'}>
                          {ip.is_active ? 'Blocked' : 'Unblocked'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {ip.is_active && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleUnblockIP(ip)}
                          >
                            Unblock
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {blockedIPs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No blocked IP addresses
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
