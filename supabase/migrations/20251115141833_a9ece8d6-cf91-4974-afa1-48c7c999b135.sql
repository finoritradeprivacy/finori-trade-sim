-- Secure increment_balance and increment_xp functions
-- Only allow service role to call these functions

CREATE OR REPLACE FUNCTION public.increment_balance(p_user_id uuid, p_amount numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only allow service role to call this function
  IF current_setting('request.jwt.claims', true)::json->>'role' != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: only backend services can modify balance';
  END IF;
  
  UPDATE user_balances
  SET usdt_balance = usdt_balance + p_amount,
      updated_at = now()
  WHERE user_id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_xp(p_user_id uuid, p_amount integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only allow service role to call this function
  IF current_setting('request.jwt.claims', true)::json->>'role' != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: only backend services can modify XP';
  END IF;
  
  UPDATE player_stats
  SET total_xp = total_xp + p_amount,
      updated_at = now()
  WHERE user_id = p_user_id;
END;
$$;