-- Add dividend_yield column to assets (4.8% annual = 0.048 for stocks)
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS dividend_yield numeric DEFAULT 0;

-- Update existing stocks to have 4.8% dividend yield
UPDATE public.assets SET dividend_yield = 0.048 WHERE category = 'stocks';

-- Create table to store 00:00 UTC portfolio snapshots for dividend eligibility
CREATE TABLE public.dividend_snapshots (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  asset_id uuid NOT NULL,
  quantity numeric NOT NULL,
  price_at_snapshot numeric NOT NULL,
  dividend_yield_at_snapshot numeric NOT NULL,
  snapshot_date date NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, asset_id, snapshot_date)
);

-- Create table to log dividend payments
CREATE TABLE public.dividend_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  asset_id uuid NOT NULL,
  snapshot_id uuid REFERENCES public.dividend_snapshots(id),
  shares_held numeric NOT NULL,
  price_at_calculation numeric NOT NULL,
  dividend_yield numeric NOT NULL,
  dividend_amount numeric NOT NULL,
  payment_date date NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create user notifications table for dividend and other notifications
CREATE TABLE public.user_notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  notification_type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  is_read boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.dividend_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dividend_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

-- RLS policies for dividend_snapshots (service role only for insert/update, users can view their own)
CREATE POLICY "Users can view their own snapshots" ON public.dividend_snapshots
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Only service role can insert snapshots" ON public.dividend_snapshots
  FOR INSERT WITH CHECK (false);

CREATE POLICY "Only service role can update snapshots" ON public.dividend_snapshots
  FOR UPDATE USING (false);

CREATE POLICY "Only service role can delete snapshots" ON public.dividend_snapshots
  FOR DELETE USING (false);

-- RLS policies for dividend_payments
CREATE POLICY "Users can view their own payments" ON public.dividend_payments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Only service role can insert payments" ON public.dividend_payments
  FOR INSERT WITH CHECK (false);

CREATE POLICY "Only service role can update payments" ON public.dividend_payments
  FOR UPDATE USING (false);

CREATE POLICY "Only service role can delete payments" ON public.dividend_payments
  FOR DELETE USING (false);

-- Admins can view all dividend data
CREATE POLICY "Admins can view all snapshots" ON public.dividend_snapshots
  FOR SELECT USING (is_admin());

CREATE POLICY "Admins can view all payments" ON public.dividend_payments
  FOR SELECT USING (is_admin());

-- RLS policies for user_notifications
CREATE POLICY "Users can view their own notifications" ON public.user_notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" ON public.user_notifications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Only service role can insert notifications" ON public.user_notifications
  FOR INSERT WITH CHECK (false);

CREATE POLICY "Users can delete their own notifications" ON public.user_notifications
  FOR DELETE USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_dividend_snapshots_date ON public.dividend_snapshots(snapshot_date);
CREATE INDEX idx_dividend_snapshots_user ON public.dividend_snapshots(user_id);
CREATE INDEX idx_dividend_payments_user ON public.dividend_payments(user_id);
CREATE INDEX idx_dividend_payments_date ON public.dividend_payments(payment_date);
CREATE INDEX idx_user_notifications_user ON public.user_notifications(user_id);
CREATE INDEX idx_user_notifications_unread ON public.user_notifications(user_id, is_read) WHERE is_read = false;