import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    // Get authenticated user from JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.log('Missing authorization header');
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      console.log('Auth error:', authError?.message || 'No user found');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Use authenticated user ID instead of request body
    const userId = user.id;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let body;
    try {
      body = await req.json();
    } catch (e) {
      console.log('Failed to parse request body:', e);
      return new Response(JSON.stringify({ error: 'Invalid request body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { action } = body;
    console.log('Processing action:', action, 'for user:', userId);

    if (action === 'generate_daily_challenges') {
      // Get today's date
      const today = new Date().toISOString().split('T')[0];

      // Check if challenges already exist for today
      const { data: existing } = await supabase
        .from('daily_challenges')
        .select('id')
        .eq('challenge_date', today)
        .limit(1);

      if (!existing || existing.length === 0) {
        // Get all challenges
        const { data: allChallenges } = await supabase
          .from('challenges')
          .select('id');

        if (allChallenges && allChallenges.length >= 5) {
          // Randomly select 5 challenges
          const shuffled = allChallenges.sort(() => 0.5 - Math.random());
          const selected = shuffled.slice(0, 5);

          // Insert daily challenges
          const dailyChallenges = selected.map(c => ({
            challenge_date: today,
            challenge_id: c.id
          }));

          await supabase
            .from('daily_challenges')
            .insert(dailyChallenges);

          console.log('Generated 5 daily challenges for', today);
        }
      }
    }

    if (action === 'update_streak' && userId) {
      const today = new Date().toISOString().split('T')[0];

      // Get user's current streak
      const { data: streak, error: streakError } = await supabase
        .from('user_daily_streak')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (streakError && streakError.code !== 'PGRST116') {
        console.log('Error fetching streak:', streakError.message);
      }

      if (!streak) {
        // Create new streak
        const { error: insertError } = await supabase
          .from('user_daily_streak')
          .insert({
            user_id: userId,
            current_streak: 1,
            last_login_date: today,
            streak_history: [{ date: today, status: 'completed' }]
          });

        if (insertError) {
          console.log('Error creating streak:', insertError.message);
        }

        console.log('Created new streak for user:', userId);
        return new Response(JSON.stringify({ streak: 1, new: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } else {
        const lastLogin = new Date(streak.last_login_date);
        const todayDate = new Date(today);
        const diffDays = Math.floor((todayDate.getTime() - lastLogin.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
          // Already logged in today, do nothing
          console.log('User already logged in today, streak:', streak.current_streak);
          return new Response(JSON.stringify({ streak: streak.current_streak }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } else if (diffDays === 1) {
          // Consecutive day
          const newStreak = streak.current_streak + 1;
          const history = [...(streak.streak_history || []), { date: today, status: 'completed' }];

          // Award bonus every 7 days
          if (newStreak % 7 === 0) {
            await supabase.rpc('increment_balance', {
              p_user_id: userId,
              p_amount: 500
            });

            await supabase.rpc('increment_xp', {
              p_user_id: userId,
              p_amount: 250
            });
            console.log('Awarded 7-day streak bonus to user:', userId);
          }

          await supabase
            .from('user_daily_streak')
            .update({
              current_streak: newStreak,
              last_login_date: today,
              streak_history: history,
              updated_at: new Date().toISOString()
            })
            .eq('user_id', userId);

          console.log('Updated streak to', newStreak, 'for user:', userId);
          return new Response(JSON.stringify({ streak: newStreak, bonus: newStreak % 7 === 0 }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } else {
          // Streak broken
          const history = [{ date: today, status: 'completed' }];

          await supabase
            .from('user_daily_streak')
            .update({
              current_streak: 1,
              last_login_date: today,
              streak_history: history,
              updated_at: new Date().toISOString()
            })
            .eq('user_id', userId);

          console.log('Streak broken, reset to 1 for user:', userId);
          return new Response(JSON.stringify({ streak: 1, broken: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in manage-daily-challenges:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});