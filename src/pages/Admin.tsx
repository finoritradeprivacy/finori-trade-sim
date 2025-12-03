import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAdmin } from "@/hooks/useAdmin";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, RefreshCw, Search, Shield, Users, DollarSign, TrendingUp, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface UserData {
  id: string;
  nickname: string;
  email: string;
  usdt_balance: number;
  total_trades: number;
  win_rate: number;
  total_profit_loss: number;
  level: number;
  total_xp: number;
  is_admin: boolean;
}

const Admin = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    if (!adminLoading && !isAdmin) {
      toast.error("Přístup odepřen");
      navigate("/trade");
    }
  }, [isAdmin, adminLoading, navigate]);

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("nickname");

      if (profilesError) throw profilesError;

      const { data: balances, error: balancesError } = await supabase
        .from("user_balances")
        .select("*");

      if (balancesError) throw balancesError;

      const { data: stats, error: statsError } = await supabase
        .from("player_stats")
        .select("*");

      if (statsError) throw statsError;

      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("*");

      if (rolesError) throw rolesError;

      const userData: UserData[] = profiles.map((profile) => {
        const balance = balances?.find((b) => b.user_id === profile.id);
        const stat = stats?.find((s) => s.user_id === profile.id);
        const role = roles?.find((r) => r.user_id === profile.id && r.role === "admin");

        return {
          id: profile.id,
          nickname: profile.nickname,
          email: profile.email,
          usdt_balance: balance?.usdt_balance || 0,
          total_trades: profile.total_trades || 0,
          win_rate: profile.win_rate || 0,
          total_profit_loss: profile.total_profit_loss || 0,
          level: stat?.level || 1,
          total_xp: stat?.total_xp || 0,
          is_admin: !!role,
        };
      });

      setUsers(userData);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Chyba při načítání uživatelů");
    } finally {
      setLoading(false);
    }
  };

  const handleResetAccount = async () => {
    if (!selectedUser) return;

    setResetting(true);
    try {
      // Reset balance to 100,000
      const { error: balanceError } = await supabase
        .from("user_balances")
        .update({ usdt_balance: 100000, locked_balance: 0 })
        .eq("user_id", selectedUser.id);

      if (balanceError) throw balanceError;

      // Reset profile stats
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ total_trades: 0, win_rate: 0, total_profit_loss: 0 })
        .eq("id", selectedUser.id);

      if (profileError) throw profileError;

      // Reset player stats
      const { error: statsError } = await supabase
        .from("player_stats")
        .update({ total_xp: 0, level: 1, achievements: [] })
        .eq("user_id", selectedUser.id);

      if (statsError) throw statsError;

      // Delete portfolios
      const { error: portfolioError } = await supabase
        .from("portfolios")
        .delete()
        .eq("user_id", selectedUser.id);

      if (portfolioError) throw portfolioError;

      // Delete orders
      const { error: ordersError } = await supabase
        .from("orders")
        .delete()
        .eq("user_id", selectedUser.id);

      if (ordersError) throw ordersError;

      // Delete trades
      const { error: tradesError } = await supabase
        .from("trades")
        .delete()
        .eq("user_id", selectedUser.id);

      if (tradesError) throw tradesError;

      toast.success(`Účet uživatele ${selectedUser.nickname} byl resetován`);
      setResetDialogOpen(false);
      fetchUsers();
    } catch (error) {
      console.error("Error resetting account:", error);
      toast.error("Chyba při resetování účtu");
    } finally {
      setResetting(false);
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.nickname.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalBalance = users.reduce((sum, u) => sum + u.usdt_balance, 0);
  const totalTrades = users.reduce((sum, u) => sum + u.total_trades, 0);
  const avgWinRate = users.length > 0 ? users.reduce((sum, u) => sum + u.win_rate, 0) / users.length : 0;

  if (adminLoading || (!isAdmin && !adminLoading)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Načítání...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/trade")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-2">
                <Shield className="h-6 w-6 text-primary" />
                <h1 className="text-xl font-bold">Admin Panel</h1>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={fetchUsers} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Obnovit
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Users className="h-4 w-4" />
                Celkem uživatelů
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{users.length}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Celkový balance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                ${totalBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Celkem obchodů
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{totalTrades}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Průměrná výhernost
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{avgWinRate.toFixed(1)}%</p>
            </CardContent>
          </Card>
        </div>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Správa uživatelů</CardTitle>
                <CardDescription>
                  Zobrazení a správa všech účtů
                </CardDescription>
              </div>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Hledat uživatele..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Uživatel</TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead>Obchody</TableHead>
                    <TableHead>Výhernost</TableHead>
                    <TableHead>P&L</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead className="text-right">Akce</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <div className="animate-pulse text-muted-foreground">Načítání...</div>
                      </TableCell>
                    </TableRow>
                  ) : filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        Žádní uživatelé nenalezeni
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div>
                              <p className="font-medium flex items-center gap-2">
                                {u.nickname}
                                {u.is_admin && (
                                  <Badge variant="secondary" className="text-xs">
                                    <Shield className="h-3 w-3 mr-1" />
                                    Admin
                                  </Badge>
                                )}
                              </p>
                              <p className="text-xs text-muted-foreground">{u.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono">
                            ${u.usdt_balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </span>
                        </TableCell>
                        <TableCell>{u.total_trades}</TableCell>
                        <TableCell>{u.win_rate.toFixed(1)}%</TableCell>
                        <TableCell>
                          <span className={u.total_profit_loss >= 0 ? "text-success" : "text-destructive"}>
                            {u.total_profit_loss >= 0 ? "+" : ""}
                            ${u.total_profit_loss.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">Lvl {u.level}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Dialog open={resetDialogOpen && selectedUser?.id === u.id} onOpenChange={(open) => {
                            setResetDialogOpen(open);
                            if (!open) setSelectedUser(null);
                          }}>
                            <DialogTrigger asChild>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => setSelectedUser(u)}
                                disabled={u.id === user?.id}
                              >
                                <RefreshCw className="h-4 w-4 mr-1" />
                                Reset
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                  <AlertTriangle className="h-5 w-5 text-destructive" />
                                  Resetovat účet?
                                </DialogTitle>
                                <DialogDescription>
                                  Tato akce resetuje účet uživatele <strong>{selectedUser?.nickname}</strong> na výchozí stav:
                                  <ul className="mt-2 space-y-1 text-sm">
                                    <li>• Balance: 100,000 USDT</li>
                                    <li>• Level: 1, XP: 0</li>
                                    <li>• Smazání všech obchodů a portfolia</li>
                                    <li>• Vynulování statistik</li>
                                  </ul>
                                </DialogDescription>
                              </DialogHeader>
                              <DialogFooter>
                                <Button variant="outline" onClick={() => setResetDialogOpen(false)}>
                                  Zrušit
                                </Button>
                                <Button
                                  variant="destructive"
                                  onClick={handleResetAccount}
                                  disabled={resetting}
                                >
                                  {resetting ? "Resetuji..." : "Resetovat účet"}
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Admin;
