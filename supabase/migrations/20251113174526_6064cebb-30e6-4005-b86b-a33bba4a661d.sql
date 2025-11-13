-- Create helper functions for incrementing balance and XP
CREATE OR REPLACE FUNCTION public.increment_balance(p_user_id UUID, p_amount NUMERIC)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE user_balances
  SET usdt_balance = usdt_balance + p_amount,
      updated_at = now()
  WHERE user_id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_xp(p_user_id UUID, p_amount INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE player_stats
  SET total_xp = total_xp + p_amount,
      updated_at = now()
  WHERE user_id = p_user_id;
END;
$$;