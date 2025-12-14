-- Create hourly price history table for 1h, 4h timeframes
CREATE TABLE public.price_history_hourly (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id UUID NOT NULL,
  time BIGINT NOT NULL,
  open NUMERIC NOT NULL,
  high NUMERIC NOT NULL,
  low NUMERIC NOT NULL,
  close NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT price_history_hourly_unique UNIQUE (asset_id, time)
);

-- Create daily price history table for 1d, 1w timeframes
CREATE TABLE public.price_history_daily (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id UUID NOT NULL,
  time BIGINT NOT NULL,
  open NUMERIC NOT NULL,
  high NUMERIC NOT NULL,
  low NUMERIC NOT NULL,
  close NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT price_history_daily_unique UNIQUE (asset_id, time)
);

-- Enable RLS
ALTER TABLE public.price_history_hourly ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_history_daily ENABLE ROW LEVEL SECURITY;

-- Create read-only policies (same as price_history)
CREATE POLICY "Anyone can view hourly price history" 
ON public.price_history_hourly 
FOR SELECT 
USING (true);

CREATE POLICY "Only service role can insert hourly" 
ON public.price_history_hourly 
FOR INSERT 
WITH CHECK (false);

CREATE POLICY "Only service role can update hourly" 
ON public.price_history_hourly 
FOR UPDATE 
USING (false);

CREATE POLICY "Only service role can delete hourly" 
ON public.price_history_hourly 
FOR DELETE 
USING (false);

CREATE POLICY "Anyone can view daily price history" 
ON public.price_history_daily 
FOR SELECT 
USING (true);

CREATE POLICY "Only service role can insert daily" 
ON public.price_history_daily 
FOR INSERT 
WITH CHECK (false);

CREATE POLICY "Only service role can update daily" 
ON public.price_history_daily 
FOR UPDATE 
USING (false);

CREATE POLICY "Only service role can delete daily" 
ON public.price_history_daily 
FOR DELETE 
USING (false);

-- Create indexes for fast lookups
CREATE INDEX idx_price_history_hourly_asset_time ON public.price_history_hourly(asset_id, time DESC);
CREATE INDEX idx_price_history_daily_asset_time ON public.price_history_daily(asset_id, time DESC);

-- Add index to existing price_history for better performance
CREATE INDEX IF NOT EXISTS idx_price_history_asset_time ON public.price_history(asset_id, time DESC);