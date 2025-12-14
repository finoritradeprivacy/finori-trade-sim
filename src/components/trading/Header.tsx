import { useAuth } from "@/contexts/AuthContext";
import { useAdmin } from "@/hooks/useAdmin";
import { Button } from "@/components/ui/button";
import { LogOut, User, Shield, Menu, Info, Phone, HelpCircle, MessageSquare } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { UserNotifications } from "./UserNotifications";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const Header = () => {
  const { user, signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const navigate = useNavigate();
  const [balance, setBalance] = useState(0);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) return;

      const { data: balanceData } = await supabase
        .from("user_balances")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (balanceData) {
        setBalance(Number(balanceData.usdt_balance));
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profileData) {
        setProfile(profileData);
      }
    };

    fetchUserData();

    const channel = supabase
      .channel('balance-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_balances',
          filter: `user_id=eq.${user?.id}`
        },
        (payload) => {
          if (payload.new) {
            setBalance(Number((payload.new as any).usdt_balance));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-2xl font-bold text-gradient">FinoriTrade</h1>
            
            <div className="hidden md:flex items-center gap-4">
              {isAdmin && (
                <button
                  onClick={() => navigate("/admin")}
                  className="flex items-center gap-2 px-4 py-2 bg-destructive/10 rounded-lg border border-destructive/20 hover:bg-destructive/20 transition-colors"
                >
                  <Shield className="w-4 h-4 text-destructive" />
                  <span className="text-sm font-medium">Admin</span>
                </button>
              )}
              
              <button
                onClick={() => navigate("/profile")}
                className="flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-lg border border-primary/20 hover:bg-primary/20 transition-colors"
              >
                <User className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">{profile?.nickname}</span>
              </button>
              
              <div className="px-4 py-2 bg-secondary rounded-lg">
                <p className="text-xs text-muted-foreground">Balance</p>
                <p className="text-lg font-bold font-mono">
                  ${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <UserNotifications />
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="w-5 h-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => navigate("/about")} className="cursor-pointer">
                  <Info className="w-4 h-4 mr-2" />
                  About Us
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/contacts")} className="cursor-pointer">
                  <Phone className="w-4 h-4 mr-2" />
                  Contacts
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/faq")} className="cursor-pointer">
                  <HelpCircle className="w-4 h-4 mr-2" />
                  FAQ
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a href="mailto:finoritrade.privacy@gmail.com" className="flex items-center cursor-pointer">
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Feedback
                  </a>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="ghost"
              size="sm"
              onClick={signOut}
              className="gap-2"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>

        <div className="md:hidden mt-3 flex gap-2">
          <button
            onClick={() => navigate("/profile")}
            className="flex-1 px-3 py-2 bg-primary/10 rounded-lg border border-primary/20 text-left hover:bg-primary/20 transition-colors"
          >
            <p className="text-xs text-muted-foreground">User</p>
            <p className="text-sm font-medium">{profile?.nickname}</p>
          </button>
          
          <div className="flex-1 px-3 py-2 bg-secondary rounded-lg">
            <p className="text-xs text-muted-foreground">Balance</p>
            <p className="text-sm font-bold font-mono">
              ${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
