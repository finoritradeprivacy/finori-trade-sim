-- Add user_balances to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_balances;
ALTER PUBLICATION supabase_realtime ADD TABLE public.portfolios;
ALTER PUBLICATION supabase_realtime ADD TABLE public.player_stats;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;

-- Fix process_market_order to check portfolio before selling
CREATE OR REPLACE FUNCTION public.process_market_order(
  p_user_id UUID,
  p_asset_id UUID,
  p_side TEXT,
  p_quantity NUMERIC,
  p_price NUMERIC
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id UUID;
  v_total_cost NUMERIC;
  v_balance_change NUMERIC;
  v_existing_quantity NUMERIC;
  v_existing_invested NUMERIC;
  v_new_quantity NUMERIC;
BEGIN
  -- CRITICAL SECURITY FIX: Validate that caller matches user_id
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: cannot trade on behalf of other users';
  END IF;
  
  v_total_cost := p_quantity * p_price;
  v_balance_change := CASE WHEN p_side = 'buy' THEN -v_total_cost ELSE v_total_cost END;
  
  -- For SELL orders: Check if user has sufficient portfolio quantity
  IF p_side = 'sell' THEN
    SELECT quantity INTO v_existing_quantity
    FROM portfolios
    WHERE user_id = p_user_id AND asset_id = p_asset_id;
    
    IF NOT FOUND OR v_existing_quantity IS NULL OR v_existing_quantity < p_quantity THEN
      RAISE EXCEPTION 'Insufficient portfolio: you do not own enough of this asset to sell';
    END IF;
  END IF;
  
  -- Update balance atomically (will fail if insufficient due to constraint)
  UPDATE user_balances
  SET usdt_balance = usdt_balance + v_balance_change,
      updated_at = now()
  WHERE user_id = p_user_id
  AND (p_side = 'sell' OR usdt_balance >= v_total_cost);
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;
  
  -- Insert order AFTER balance validation
  INSERT INTO orders (user_id, asset_id, side, quantity, price, status, filled_quantity, average_fill_price, filled_at, order_type)
  VALUES (p_user_id, p_asset_id, p_side, p_quantity, p_price, 'filled', p_quantity, p_price, now(), 'market')
  RETURNING id INTO v_order_id;
  
  -- Insert trade record
  INSERT INTO trades (order_id, user_id, asset_id, side, quantity, price, total_value)
  VALUES (v_order_id, p_user_id, p_asset_id, p_side, p_quantity, p_price, v_total_cost);
  
  -- Get existing portfolio if exists
  SELECT quantity, total_invested INTO v_existing_quantity, v_existing_invested
  FROM portfolios
  WHERE user_id = p_user_id AND asset_id = p_asset_id;
  
  -- Update or insert portfolio
  IF FOUND THEN
    v_new_quantity := v_existing_quantity + CASE WHEN p_side = 'buy' THEN p_quantity ELSE -p_quantity END;
    
    -- Remove portfolio entry if quantity reaches 0
    IF v_new_quantity <= 0 THEN
      DELETE FROM portfolios WHERE user_id = p_user_id AND asset_id = p_asset_id;
    ELSE
      UPDATE portfolios
      SET quantity = v_new_quantity,
          average_buy_price = CASE WHEN p_side = 'buy' THEN 
            ((v_existing_quantity * average_buy_price) + (p_quantity * p_price)) / v_new_quantity
          ELSE average_buy_price END,
          total_invested = v_existing_invested + CASE WHEN p_side = 'buy' THEN v_total_cost ELSE -v_total_cost END,
          updated_at = now()
      WHERE user_id = p_user_id AND asset_id = p_asset_id;
    END IF;
  ELSE
    IF p_side = 'buy' THEN
      INSERT INTO portfolios (user_id, asset_id, quantity, average_buy_price, total_invested)
      VALUES (p_user_id, p_asset_id, p_quantity, p_price, v_total_cost);
    END IF;
  END IF;
  
  -- Update profile trade stats
  UPDATE profiles
  SET total_trades = COALESCE(total_trades, 0) + 1,
      last_active_at = now()
  WHERE id = p_user_id;
  
  -- Award XP for trading (+25 XP per trade)
  INSERT INTO player_stats (user_id, total_xp, level)
  VALUES (p_user_id, 25, 1)
  ON CONFLICT (user_id) DO UPDATE
  SET total_xp = player_stats.total_xp + 25,
      level = GREATEST(1, FLOOR((player_stats.total_xp + 25) / 1000)::int + 1),
      updated_at = now();
  
  RETURN v_order_id;
END;
$$;