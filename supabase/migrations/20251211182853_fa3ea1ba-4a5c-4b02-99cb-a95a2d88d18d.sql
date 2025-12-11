-- Fix 1: Add admin authorization check to log_admin_action function
CREATE OR REPLACE FUNCTION public.log_admin_action(p_action_type text, p_entity_type text, p_entity_id text DEFAULT NULL::text, p_details jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_log_id UUID;
BEGIN
  -- CRITICAL: Verify caller is an admin
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  INSERT INTO public.audit_logs (user_id, action_type, entity_type, entity_id, details)
  VALUES (auth.uid(), p_action_type, p_entity_type, p_entity_id, p_details)
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$function$;

-- Fix 2: Restrict audit_logs INSERT to service role only
DROP POLICY IF EXISTS "Service can insert audit logs" ON audit_logs;
CREATE POLICY "Only service role can insert audit logs" 
ON audit_logs FOR INSERT
WITH CHECK (false);