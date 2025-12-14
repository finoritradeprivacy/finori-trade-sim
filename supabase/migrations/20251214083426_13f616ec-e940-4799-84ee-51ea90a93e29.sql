-- Fix calculate_total_xp_for_level to use formula instead of loop (prevents timeout for high levels)
-- Formula: For level L, XP = sum of (1000 + (i-1)*500) for i=1 to L
-- This simplifies to: 1000*L + 500*(L*(L-1)/2) = 1000*L + 250*L*(L-1) = L*(1000 + 250*(L-1)) = L*(750 + 250*L)
CREATE OR REPLACE FUNCTION public.calculate_total_xp_for_level(target_level integer)
 RETURNS integer
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
BEGIN
  IF target_level <= 0 THEN
    RETURN 0;
  END IF;
  -- Formula: sum of XP for levels 1 to target_level
  -- Each level i needs: 1000 + (i-1)*500 = 500 + 500*i
  -- Sum from 1 to L: L*500 + 500*(1+2+...+L) = 500*L + 500*L*(L+1)/2 = 500*L + 250*L*(L+1)
  -- = 250*L*(2 + L + 1) = 250*L*(L+3)
  RETURN 250 * target_level * (target_level + 3);
END;
$function$;