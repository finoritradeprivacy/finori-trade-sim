-- Create enum for challenge types
CREATE TYPE public.challenge_type AS ENUM (
  'trades_count',
  'profit_percentage',
  'portfolio_diversity',
  'consecutive_profits',
  'small_loss',
  'trend_lines',
  'loss_then_profit',
  'news_reactions',
  'night_trade',
  'portfolio_size',
  'trade_value',
  'trades_in_hour',
  'holding_time',
  'multi_market',
  'timeframe_views',
  'chart_note',
  'active_time',
  'quick_profit',
  'news_trade',
  'quick_trades',
  'daily_xp',
  'no_losses',
  'timeframe_changes'
);

-- Create challenges master table
CREATE TABLE public.challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_type challenge_type NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  reward_usdt NUMERIC NOT NULL,
  reward_xp INTEGER NOT NULL,
  target_value NUMERIC NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create daily challenges table (5 random challenges per day)
CREATE TABLE public.daily_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_date DATE NOT NULL,
  challenge_id UUID NOT NULL REFERENCES challenges(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(challenge_date, challenge_id)
);

-- Create user challenge progress table
CREATE TABLE public.user_challenge_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  daily_challenge_id UUID NOT NULL REFERENCES daily_challenges(id) ON DELETE CASCADE,
  current_value NUMERIC NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, daily_challenge_id)
);

-- Create user daily streak table
CREATE TABLE public.user_daily_streak (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_streak INTEGER NOT NULL DEFAULT 0,
  last_login_date DATE NOT NULL,
  streak_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_challenge_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_daily_streak ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view challenges"
  ON public.challenges FOR SELECT
  USING (true);

CREATE POLICY "Anyone can view daily challenges"
  ON public.daily_challenges FOR SELECT
  USING (true);

CREATE POLICY "Users can view their own progress"
  ON public.user_challenge_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own progress"
  ON public.user_challenge_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own progress"
  ON public.user_challenge_progress FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own streak"
  ON public.user_daily_streak FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own streak"
  ON public.user_daily_streak FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own streak"
  ON public.user_daily_streak FOR UPDATE
  USING (auth.uid() = user_id);

-- Insert all challenges
INSERT INTO public.challenges (challenge_type, title, description, reward_usdt, reward_xp, target_value) VALUES
  ('trades_count', 'Make 2 Buys and 2 Sells', 'Complete 2 buy and 2 sell orders', 150, 200, 4),
  ('profit_percentage', 'Complete Trade with 2%+ Profit', 'Finish a trade with at least 2% profit', 100, 200, 2),
  ('portfolio_diversity', 'Hold 3 Different Asset Types', 'Have at least 3 different assets in your portfolio', 150, 250, 3),
  ('consecutive_profits', 'Make 5 Profitable Trades in a Row', 'Complete 5 consecutive profitable trades', 250, 400, 5),
  ('small_loss', 'Sell with Less Than 1% Loss', 'Sell an asset with loss smaller than 1%', 100, 200, 1),
  ('trend_lines', 'Draw 3 Trend Lines', 'Draw at least 3 trend lines on the chart', 150, 250, 3),
  ('loss_then_profit', '3 Losses Then 1 Profit', 'Have 3 losing trades followed by one profitable trade', 200, 400, 1),
  ('news_reactions', 'React to 5 Market News in 5 Minutes', 'React to 5 Market News within 5 minutes each', 150, 650, 5),
  ('night_trade', 'Trade During Night Hours', 'Make a trade between 23:00-05:00', 200, 300, 1),
  ('portfolio_size', 'Hold 10+ Different Assets', 'Have 10 or more different assets in portfolio', 250, 350, 10),
  ('trade_value', 'Make a Trade Worth 5,000+ USDT', 'Execute a trade worth at least 5,000 USDT', 200, 300, 5000),
  ('trades_in_hour', 'Complete 3 Trades in 1 Hour', 'Finish 3 trades within one hour', 150, 250, 3),
  ('holding_time', 'Sell Asset Held 30+ Minutes', 'Sell an asset you held for more than 30 minutes', 100, 200, 1),
  ('multi_market', 'Trade in All Markets', 'Make at least 1 trade in Crypto, Stocks, and Forex', 200, 300, 3),
  ('timeframe_views', 'View 3 Different Timeframes', 'Check 3 different timeframes in the chart', 100, 150, 3),
  ('chart_note', 'Add a Chart Note', 'Add a note to the chart', 75, 100, 1),
  ('active_time', 'Stay Active 60 Minutes', 'Remain active for at least 60 minutes', 300, 300, 60),
  ('quick_profit', 'Buy and Sell with 1%+ Profit', 'Buy an asset and sell it with at least 1% profit', 120, 250, 1),
  ('news_trade', 'Sell Within 5 Minutes of News', 'Sell an asset within 5 minutes after Market News', 120, 200, 1),
  ('quick_trades', '3 Trades in 10 Minutes', 'Make 3 quick trades within 10 minutes', 180, 300, 3),
  ('daily_xp', 'Gain 1,000 XP Today', 'Earn 1,000 XP during the day', 200, 400, 1000),
  ('no_losses', 'Keep Portfolio Without Losses', 'No losing trades for the entire day', 350, 500, 1),
  ('timeframe_changes', 'Change Timeframe 5 Times', 'Change timeframe 5 times during one chart session', 120, 180, 5);