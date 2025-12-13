-- Create a function to delete user account that bypasses RLS
CREATE OR REPLACE FUNCTION public.admin_delete_user_account(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if caller is admin
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Only admins can delete user accounts';
  END IF;

  -- Delete all user data in correct order (respecting foreign keys)
  DELETE FROM public.portfolios WHERE user_id = p_user_id;
  DELETE FROM public.trades WHERE user_id = p_user_id;
  DELETE FROM public.orders WHERE user_id = p_user_id;
  DELETE FROM public.price_alerts WHERE user_id = p_user_id;
  DELETE FROM public.user_notifications WHERE user_id = p_user_id;
  DELETE FROM public.user_challenge_progress WHERE user_id = p_user_id;
  DELETE FROM public.user_daily_streak WHERE user_id = p_user_id;
  DELETE FROM public.dividend_payments WHERE user_id = p_user_id;
  DELETE FROM public.dividend_snapshots WHERE user_id = p_user_id;
  DELETE FROM public.promo_code_redemptions WHERE user_id = p_user_id;
  DELETE FROM public.user_sessions WHERE user_id = p_user_id;
  DELETE FROM public.user_bans WHERE user_id = p_user_id;
  DELETE FROM public.user_restrictions WHERE user_id = p_user_id;
  DELETE FROM public.user_roles WHERE user_id = p_user_id;
  DELETE FROM public.player_stats WHERE user_id = p_user_id;
  DELETE FROM public.user_balances WHERE user_id = p_user_id;
  DELETE FROM public.profiles WHERE id = p_user_id;
END;
$$;