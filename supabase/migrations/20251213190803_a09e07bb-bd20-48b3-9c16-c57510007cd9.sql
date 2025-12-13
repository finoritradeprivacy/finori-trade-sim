-- Create table for pending email verifications with OTP codes
CREATE TABLE public.pending_email_verifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  nickname TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  otp_code TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '10 minutes'),
  verified BOOLEAN NOT NULL DEFAULT false
);

-- Create index for fast lookups
CREATE INDEX idx_pending_verifications_email ON public.pending_email_verifications(email);
CREATE INDEX idx_pending_verifications_expires ON public.pending_email_verifications(expires_at);

-- No RLS needed - this table is accessed via edge functions with service role