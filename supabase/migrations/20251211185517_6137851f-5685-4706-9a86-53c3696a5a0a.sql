-- Fix 1: Add authorization check to create_admin_notification function
CREATE OR REPLACE FUNCTION public.create_admin_notification(p_type text, p_title text, p_message text, p_severity text DEFAULT 'info'::text, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_notification_id UUID;
BEGIN
  -- CRITICAL: Verify caller is an admin
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  INSERT INTO public.admin_notifications (notification_type, title, message, severity, metadata)
  VALUES (p_type, p_title, p_message, p_severity, p_metadata)
  RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$function$;

-- Fix 2: Restrict user_sessions INSERT to service role only
DROP POLICY IF EXISTS "Service can insert sessions" ON user_sessions;
CREATE POLICY "Only service role can insert sessions" 
ON user_sessions FOR INSERT
WITH CHECK (false);

-- Fix 3: Restrict user_sessions UPDATE to service role only
DROP POLICY IF EXISTS "Service can update sessions" ON user_sessions;
CREATE POLICY "Only service role can update sessions" 
ON user_sessions FOR UPDATE
USING (false);

-- Fix 4: Restrict admin_notifications INSERT to service role only
DROP POLICY IF EXISTS "Service can insert notifications" ON admin_notifications;
CREATE POLICY "Only service role can insert notifications" 
ON admin_notifications FOR INSERT
WITH CHECK (false);