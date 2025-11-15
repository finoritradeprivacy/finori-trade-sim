-- Create a configuration table to store the cron secret
CREATE TABLE IF NOT EXISTS public.system_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on the config table (only service role can access)
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only service role can manage config"
ON public.system_config
FOR ALL
USING (false)
WITH CHECK (false);

-- Create a function to get config values
CREATE OR REPLACE FUNCTION public.get_config(p_key TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_value TEXT;
BEGIN
  SELECT value INTO v_value FROM system_config WHERE key = p_key;
  RETURN v_value;
END;
$$;