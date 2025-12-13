-- Drop existing restrictive INSERT policies and recreate with service role bypass
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own balance" ON public.user_balances;
DROP POLICY IF EXISTS "Users can insert their own stats" ON public.player_stats;

-- Create new INSERT policies that allow both users and the trigger
CREATE POLICY "Allow profile creation" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = id OR auth.uid() IS NULL);

CREATE POLICY "Allow balance creation" 
ON public.user_balances 
FOR INSERT 
WITH CHECK (auth.uid() = user_id OR auth.uid() IS NULL);

CREATE POLICY "Allow stats creation" 
ON public.player_stats 
FOR INSERT 
WITH CHECK (auth.uid() = user_id OR auth.uid() IS NULL);