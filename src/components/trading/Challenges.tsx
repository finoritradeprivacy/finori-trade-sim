import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, XCircle, Trophy, Flame } from "lucide-react";
import { toast } from "sonner";

interface Challenge {
  id: string;
  title: string;
  description: string;
  reward_usdt: number;
  reward_xp: number;
  target_value: number;
  current_value: number;
  completed: boolean;
}

interface DayStatus {
  day: string;
  status: 'pending' | 'completed' | 'missed';
}

export const Challenges = () => {
  const { user } = useAuth();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [streak, setStreak] = useState(0);
  const [weekStatus, setWeekStatus] = useState<DayStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      initializeChallenges();
      updateStreak();
    }
  }, [user]);

  const initializeChallenges = async () => {
    try {
      // Generate daily challenges if needed
      await supabase.functions.invoke('manage-daily-challenges', {
        body: { action: 'generate_daily_challenges' }
      });

      // Get today's challenges with user progress
      const today = new Date().toISOString().split('T')[0];
      
      const { data: dailyChallenges } = await supabase
        .from('daily_challenges' as any)
        .select(`
          id,
          challenges (
            title,
            description,
            reward_usdt,
            reward_xp,
            target_value
          )
        `)
        .eq('challenge_date', today);

      if (dailyChallenges) {
        const challengesWithProgress = await Promise.all(
          dailyChallenges.map(async (dc: any) => {
            const { data: progress } = await supabase
              .from('user_challenge_progress' as any)
              .select('current_value, completed')
              .eq('user_id', user!.id)
              .eq('daily_challenge_id', dc.id)
              .single();

            return {
              id: dc.id,
              ...dc.challenges,
              current_value: (progress as any)?.current_value || 0,
              completed: (progress as any)?.completed || false
            };
          })
        );

        setChallenges(challengesWithProgress);
      }
    } catch (error) {
      console.error('Error loading challenges:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateStreak = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('manage-daily-challenges', {
        body: { action: 'update_streak', userId: user!.id }
      });

      if (data?.streak) {
        setStreak(data.streak);
        
        if (data.bonus) {
          toast.success('🎉 7-Day Streak Bonus!', {
            description: '+500 USDT and +250 XP awarded!'
          });
        }
        
        if (data.broken) {
          toast.warning('Streak Reset', {
            description: 'Your daily streak was reset. Keep logging in daily!'
          });
        }
      }

      // Generate week status
      const { data: streakData } = await supabase
        .from('user_daily_streak' as any)
        .select('streak_history')
        .eq('user_id', user!.id)
        .single();

      if (streakData) {
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const history = Array.isArray((streakData as any).streak_history) ? (streakData as any).streak_history : [];
        const today = new Date();
        const currentDay = today.getDay();
        const mondayOffset = currentDay === 0 ? 6 : currentDay - 1;
        
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - mondayOffset);

        const week: DayStatus[] = days.map((day, index) => {
          const date = new Date(weekStart);
          date.setDate(weekStart.getDate() + index);
          const dateStr = date.toISOString().split('T')[0];
          const todayStr = today.toISOString().split('T')[0];
          
          const logged = history.some((h: any) => h && typeof h === 'object' && h.date === dateStr);
          
          let status: 'pending' | 'completed' | 'missed' = 'pending';
          if (logged) {
            status = 'completed';
          } else if (date < today && dateStr !== todayStr) {
            status = 'missed';
          }
          
          return { day, status };
        });

        setWeekStatus(week);
      }
    } catch (error) {
      console.error('Error updating streak:', error);
    }
  };

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <Card className="p-6 animate-pulse">
          <div className="h-8 bg-muted rounded w-1/3 mb-4"></div>
          <div className="h-16 bg-muted rounded"></div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-h-[600px] overflow-y-auto w-full">
      {/* Daily Streak */}
      <Card className="p-6 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Flame className="h-6 w-6 text-primary" />
            <h3 className="text-xl font-bold">Daily Streak</h3>
          </div>
          <Badge variant="secondary" className="text-lg px-4 py-1">
            {streak} {streak === 1 ? 'Day' : 'Days'}
          </Badge>
        </div>

        {/* Week Overview */}
        <div className="flex justify-between mb-4">
          {weekStatus.map((day) => (
            <div key={day.day} className="flex flex-col items-center gap-1">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                day.status === 'completed' 
                  ? 'bg-primary border-primary text-primary-foreground' 
                  : day.status === 'missed'
                  ? 'bg-destructive border-destructive text-destructive-foreground'
                  : 'bg-muted border-muted-foreground/20 text-muted-foreground'
              }`}>
                {day.status === 'completed' ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : day.status === 'missed' ? (
                  <XCircle className="h-5 w-5" />
                ) : (
                  <Circle className="h-5 w-5" />
                )}
              </div>
              <span className="text-xs font-medium">{day.day}</span>
            </div>
          ))}
        </div>

        <div className="text-sm text-muted-foreground text-center">
          Every 7 days: <span className="font-semibold text-foreground">+500 USDT & +250 XP</span>
        </div>
      </Card>

      {/* Daily Challenges */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-bold">Daily Challenges</h3>
        </div>

        {challenges.map((challenge) => (
          <Card key={challenge.id} className={`p-4 ${challenge.completed ? 'bg-primary/5 border-primary/30' : ''}`}>
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  {challenge.completed && <CheckCircle2 className="h-4 w-4 text-primary" />}
                  <h4 className="font-semibold">{challenge.title}</h4>
                </div>
                <p className="text-sm text-muted-foreground">{challenge.description}</p>
              </div>
            </div>

            <Progress 
              value={(challenge.current_value / challenge.target_value) * 100} 
              className="h-2 mb-2"
            />

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {challenge.current_value} / {challenge.target_value}
              </span>
              <div className="flex gap-2">
                <Badge variant="secondary">💵 +{challenge.reward_usdt} USDT</Badge>
                <Badge variant="secondary">⭐ +{challenge.reward_xp} XP</Badge>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};