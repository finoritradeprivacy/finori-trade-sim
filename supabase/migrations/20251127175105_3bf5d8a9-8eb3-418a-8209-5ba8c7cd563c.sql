-- Drop the old handle_new_user function if it exists
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- Create comprehensive function to initialize new user data
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  generated_nickname TEXT;
BEGIN
  -- Generate unique nickname if not provided
  generated_nickname := COALESCE(
    NEW.raw_user_meta_data->>'nickname',
    'Player_' || substring(NEW.id::text from 1 for 8)
  );

  -- Create profile if it doesn't exist
  INSERT INTO public.profiles (id, email, nickname)
  VALUES (NEW.id, NEW.email, generated_nickname)
  ON CONFLICT (id) DO NOTHING;

  -- Create user balance
  INSERT INTO public.user_balances (user_id, usdt_balance)
  VALUES (NEW.id, 100000.00)
  ON CONFLICT (user_id) DO NOTHING;

  -- Create player stats
  INSERT INTO public.player_stats (user_id, total_xp, level)
  VALUES (NEW.id, 0, 1)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Create trigger on auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Fix missing data for existing users
-- First create profiles for users without them with unique nicknames
INSERT INTO public.profiles (id, email, nickname)
SELECT 
  au.id,
  au.email,
  COALESCE(
    au.raw_user_meta_data->>'nickname',
    'Player_' || substring(au.id::text from 1 for 8)
  )
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- Now create balances for users without them
INSERT INTO public.user_balances (user_id, usdt_balance)
SELECT 
  au.id,
  100000.00
FROM auth.users au
LEFT JOIN public.user_balances ub ON au.id = ub.user_id
WHERE ub.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;

-- Create player stats for users without them
INSERT INTO public.player_stats (user_id, total_xp, level)
SELECT 
  au.id,
  0,
  1
FROM auth.users au
LEFT JOIN public.player_stats ps ON au.id = ps.user_id
WHERE ps.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;