-- Fix the parameter order in update_challenge_progress_on_trade function
CREATE OR REPLACE FUNCTION public.update_challenge_progress_on_trade()
RETURNS TRIGGER AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
  v_daily_challenge RECORD;
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
    -- Get user progress
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
        SELECT COUNT(*) INTO v_trades_count
        FROM trades 
        WHERE user_id = NEW.user_id 
        AND DATE(created_at) = v_today;
        v_new_value := v_trades_count;
        
      WHEN 'trades_in_hour' THEN
        SELECT COUNT(*) INTO v_trades_in_hour
        FROM trades 
        WHERE user_id = NEW.user_id 
        AND created_at > NOW() - INTERVAL '1 hour';
        v_new_value := v_trades_in_hour;
        
      WHEN 'quick_trades' THEN
        SELECT COUNT(*) INTO v_trades_in_hour
        FROM trades 
        WHERE user_id = NEW.user_id 
        AND created_at > NOW() - INTERVAL '10 minutes';
        v_new_value := v_trades_in_hour;
        
      WHEN 'portfolio_diversity', 'portfolio_size' THEN
        SELECT COUNT(DISTINCT asset_id) INTO v_portfolio_count
        FROM portfolios
        WHERE user_id = NEW.user_id AND quantity > 0;
        v_new_value := v_portfolio_count;
        
      WHEN 'night_trade' THEN
        IF v_is_night_trade THEN
          v_new_value := 1;
        END IF;
        
      WHEN 'trade_value' THEN
        IF NEW.total_value >= 5000 THEN
          v_new_value := v_new_value + 1;
        END IF;
        
      WHEN 'multi_market' THEN
        SELECT COUNT(DISTINCT a.category) INTO v_portfolio_count
        FROM trades t
        JOIN assets a ON a.id = t.asset_id
        WHERE t.user_id = NEW.user_id 
        AND DATE(t.created_at) = v_today;
        v_new_value := v_portfolio_count;
        
      ELSE
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
    
    -- Award rewards if just completed - FIXED: correct parameter order (user_id, amount)
    IF v_new_value >= v_daily_challenge.target_value AND (v_current_progress IS NULL OR NOT v_current_progress.completed) THEN
      -- Update balance directly (service role context in trigger)
      UPDATE user_balances
      SET usdt_balance = usdt_balance + v_daily_challenge.reward_usdt,
          updated_at = NOW()
      WHERE user_id = NEW.user_id;
      
      -- Update XP directly
      UPDATE player_stats
      SET total_xp = total_xp + v_daily_challenge.reward_xp,
          updated_at = NOW()
      WHERE user_id = NEW.user_id;
      
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