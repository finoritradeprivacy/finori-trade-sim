-- Create price_alerts table
CREATE TABLE public.price_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  target_price NUMERIC NOT NULL,
  condition TEXT NOT NULL CHECK (condition IN ('above', 'below')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  triggered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.price_alerts ENABLE ROW LEVEL SECURITY;

-- Users can view their own alerts
CREATE POLICY "Users can view their own alerts"
  ON public.price_alerts FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own alerts
CREATE POLICY "Users can create their own alerts"
  ON public.price_alerts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own alerts
CREATE POLICY "Users can update their own alerts"
  ON public.price_alerts FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own alerts
CREATE POLICY "Users can delete their own alerts"
  ON public.price_alerts FOR DELETE
  USING (auth.uid() = user_id);

-- Service role can update alerts (for triggering)
CREATE POLICY "Service role can update all alerts"
  ON public.price_alerts FOR UPDATE
  USING (true);

-- Add index for faster lookups
CREATE INDEX idx_price_alerts_active ON public.price_alerts(is_active, asset_id) WHERE is_active = true;

-- Add to realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.price_alerts;