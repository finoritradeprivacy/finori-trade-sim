-- Create function to update challenge progress after trades
CREATE OR REPLACE FUNCTION public.update_challenge_progress_on_trade()
RETURNS TRIGGER AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
  v_daily_challenge RECORD;
  v_challenge RECORD;
  v_current_progress RECORD;
  v_new_value NUMERIC;
  v_trades_count INTEGER;
  v_trades_in_hour INTEGER;
  v_portfolio_count INTEGER;
  v_is_night_trade BOOLEAN;
  v_hour INTEGER;
BEGIN
  -- Get current hour for night trade check
  v_hour := EXTRACT(HOUR FROM NOW() AT TIME ZONE 'Europe/Prague');
  v_is_night_trade := (v_hour >= 23 OR v_hour < 5);
  
  -- Loop through today's daily challenges
  FOR v_daily_challenge IN 
    SELECT dc.id as daily_challenge_id, c.*
    FROM daily_challenges dc
    JOIN challenges c ON c.id = dc.challenge_id
    WHERE dc.challenge_date = v_today
  LOOP
    -- Get or create user progress
    SELECT * INTO v_current_progress
    FROM user_challenge_progress
    WHERE user_id = NEW.user_id 
    AND daily_challenge_id = v_daily_challenge.daily_challenge_id;
    
    -- Skip if already completed
    IF v_current_progress IS NOT NULL AND v_current_progress.completed THEN
      CONTINUE;
    END IF;
    
    v_new_value := COALESCE(v_current_progress.current_value, 0);
    
    -- Update based on challenge type
    CASE v_daily_challenge.challenge_type
      WHEN 'trades_count' THEN
        -- Count today's trades
        SELECT COUNT(*) INTO v_trades_count
        FROM trades 
        WHERE user_id = NEW.user_id 
        AND DATE(created_at) = v_today;
        v_new_value := v_trades_count;
        
      WHEN 'trades_in_hour' THEN
        -- Count trades in the last hour
        SELECT COUNT(*) INTO v_trades_in_hour
        FROM trades 
        WHERE user_id = NEW.user_id 
        AND created_at > NOW() - INTERVAL '1 hour';
        v_new_value := v_trades_in_hour;
        
      WHEN 'quick_trades' THEN
        -- Count trades in the last 10 minutes
        SELECT COUNT(*) INTO v_trades_in_hour
        FROM trades 
        WHERE user_id = NEW.user_id 
        AND created_at > NOW() - INTERVAL '10 minutes';
        v_new_value := v_trades_in_hour;
        
      WHEN 'portfolio_diversity', 'portfolio_size' THEN
        -- Count different assets in portfolio
        SELECT COUNT(DISTINCT asset_id) INTO v_portfolio_count
        FROM portfolios
        WHERE user_id = NEW.user_id AND quantity > 0;
        v_new_value := v_portfolio_count;
        
      WHEN 'night_trade' THEN
        -- Check if this is a night trade
        IF v_is_night_trade THEN
          v_new_value := 1;
        END IF;
        
      WHEN 'trade_value' THEN
        -- Check if this trade is >= 5000 USDT
        IF NEW.total_value >= 5000 THEN
          v_new_value := v_new_value + 1;
        END IF;
        
      WHEN 'multi_market' THEN
        -- Count distinct asset categories user has traded today
        SELECT COUNT(DISTINCT a.category) INTO v_portfolio_count
        FROM trades t
        JOIN assets a ON a.id = t.asset_id
        WHERE t.user_id = NEW.user_id 
        AND DATE(t.created_at) = v_today;
        v_new_value := v_portfolio_count;
        
      ELSE
        -- For other challenge types, just increment by 1 for each trade
        v_new_value := v_new_value + 1;
    END CASE;
    
    -- Insert or update progress
    INSERT INTO user_challenge_progress (user_id, daily_challenge_id, current_value, completed, completed_at, updated_at)
    VALUES (
      NEW.user_id, 
      v_daily_challenge.daily_challenge_id, 
      v_new_value, 
      v_new_value >= v_daily_challenge.target_value,
      CASE WHEN v_new_value >= v_daily_challenge.target_value THEN NOW() ELSE NULL END,
      NOW()
    )
    ON CONFLICT (user_id, daily_challenge_id) DO UPDATE SET
      current_value = EXCLUDED.current_value,
      completed = EXCLUDED.completed,
      completed_at = CASE WHEN EXCLUDED.completed AND user_challenge_progress.completed_at IS NULL THEN NOW() ELSE user_challenge_progress.completed_at END,
      updated_at = NOW();
    
    -- Award rewards if just completed
    IF v_new_value >= v_daily_challenge.target_value AND (v_current_progress IS NULL OR NOT v_current_progress.completed) THEN
      -- Award USDT
      PERFORM increment_balance(v_daily_challenge.reward_usdt, NEW.user_id);
      
      -- Award XP
      PERFORM increment_xp(v_daily_challenge.reward_xp, NEW.user_id);
      
      -- Create notification
      INSERT INTO user_notifications (user_id, notification_type, title, message, metadata)
      VALUES (
        NEW.user_id,
        'challenge_completed',
        'Challenge Completed!',
        'You completed: ' || v_daily_challenge.title || ' - Earned ' || v_daily_challenge.reward_usdt || ' USDT and ' || v_daily_challenge.reward_xp || ' XP!',
        jsonb_build_object('challenge_id', v_daily_challenge.id, 'reward_usdt', v_daily_challenge.reward_usdt, 'reward_xp', v_daily_challenge.reward_xp)
      );
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create unique constraint for user_challenge_progress if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_challenge_progress_user_daily_unique'
  ) THEN
    ALTER TABLE user_challenge_progress ADD CONSTRAINT user_challenge_progress_user_daily_unique UNIQUE (user_id, daily_challenge_id);
  END IF;
END $$;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trigger_update_challenge_progress ON trades;

-- Create trigger on trades table
CREATE TRIGGER trigger_update_challenge_progress
AFTER INSERT ON trades
FOR EACH ROW
EXECUTE FUNCTION update_challenge_progress_on_trade();

-- Update XP level calculation to use target level 15487
CREATE OR REPLACE FUNCTION public.calculate_xp_for_level(target_level INTEGER)
RETURNS INTEGER AS $$
BEGIN
  -- Level 1 = 1000 XP, then +500 per level
  IF target_level <= 1 THEN
    RETURN 1000;
  END IF;
  RETURN 1000 + (target_level - 1) * 500;
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;

-- Update player_stats level calculation in process_market_order to use correct formula
CREATE OR REPLACE FUNCTION public.calculate_level_from_xp(total_xp INTEGER)
RETURNS INTEGER AS $$
DECLARE
  v_level INTEGER := 1;
  v_xp_needed INTEGER := 1000;
BEGIN
  -- Level 1 needs 1000 XP, each subsequent level needs 500 more
  WHILE total_xp >= v_xp_needed AND v_level < 15487 LOOP
    v_level := v_level + 1;
    v_xp_needed := v_xp_needed + 500 + (v_level - 1) * 500;
  END LOOP;
  RETURN v_level;
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;