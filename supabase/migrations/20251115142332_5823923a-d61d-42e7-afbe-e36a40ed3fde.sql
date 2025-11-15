-- Fix user impersonation vulnerability in process_market_order
-- Add validation that p_user_id matches the authenticated user

CREATE OR REPLACE FUNCTION public.process_market_order(
  p_user_id uuid, 
  p_asset_id uuid, 
  p_side text, 
  p_quantity numeric, 
  p_price numeric
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_order_id UUID;
  v_total_cost NUMERIC;
  v_balance_change NUMERIC;
  v_existing_quantity NUMERIC;
  v_existing_invested NUMERIC;
BEGIN
  -- CRITICAL SECURITY FIX: Validate that caller matches user_id
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: cannot trade on behalf of other users';
  END IF;
  
  v_total_cost := p_quantity * p_price;
  v_balance_change := CASE WHEN p_side = 'buy' THEN -v_total_cost ELSE v_total_cost END;
  
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
  
  -- Get existing portfolio if exists
  SELECT quantity, total_invested INTO v_existing_quantity, v_existing_invested
  FROM portfolios
  WHERE user_id = p_user_id AND asset_id = p_asset_id;
  
  -- Update or insert portfolio
  IF FOUND THEN
    UPDATE portfolios
    SET quantity = v_existing_quantity + CASE WHEN p_side = 'buy' THEN p_quantity ELSE -p_quantity END,
        average_buy_price = p_price,
        total_invested = v_existing_invested + CASE WHEN p_side = 'buy' THEN v_total_cost ELSE -v_total_cost END,
        updated_at = now()
    WHERE user_id = p_user_id AND asset_id = p_asset_id;
  ELSE
    IF p_side = 'buy' THEN
      INSERT INTO portfolios (user_id, asset_id, quantity, average_buy_price, total_invested)
      VALUES (p_user_id, p_asset_id, p_quantity, p_price, v_total_cost);
    END IF;
  END IF;
  
  RETURN v_order_id;
END;
$function$;