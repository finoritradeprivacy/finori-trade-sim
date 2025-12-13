-- Enable RLS on pending_email_verifications table
ALTER TABLE public.pending_email_verifications ENABLE ROW LEVEL SECURITY;

-- No policies needed - table is accessed only via edge functions with service role key