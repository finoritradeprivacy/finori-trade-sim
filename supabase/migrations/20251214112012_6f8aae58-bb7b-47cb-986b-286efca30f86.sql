
-- Fix security issue: pending_email_verifications table has RLS enabled but no policies
-- Add explicit deny-all policy - only service role (edge functions) can access

CREATE POLICY "Block all direct access" 
ON public.pending_email_verifications 
FOR ALL 
USING (false);
