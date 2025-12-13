-- Update calculate_level_from_xp to allow max level 20000
CREATE OR REPLACE FUNCTION public.calculate_level_from_xp(total_xp integer)
 RETURNS integer
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  v_level INTEGER := 1;
  v_xp_needed INTEGER := 1000;
BEGIN
  -- Level 1 needs 1000 XP, each subsequent level needs 500 more
  WHILE total_xp >= v_xp_needed AND v_level < 20000 LOOP
    v_level := v_level + 1;
    v_xp_needed := v_xp_needed + 500 + (v_level - 1) * 500;
  END LOOP;
  RETURN v_level;
END;
$function$;