-- Create function to increment played time
CREATE OR REPLACE FUNCTION public.increment_played_time(p_user_id uuid, p_seconds integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles
  SET played_time_seconds = COALESCE(played_time_seconds, 0) + p_seconds,
      last_active_at = now()
  WHERE id = p_user_id;
END;
$$;