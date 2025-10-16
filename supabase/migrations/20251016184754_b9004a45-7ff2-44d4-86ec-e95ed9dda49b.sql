-- Add category to assets and create news/events system
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'crypto';
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS description text;

-- Create news_events table
CREATE TABLE IF NOT EXISTS public.news_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  headline text NOT NULL,
  content text NOT NULL,
  event_type text NOT NULL, -- 'earnings', 'macro', 'geopolitical', 'sentiment'
  impact_type text NOT NULL, -- 'bullish', 'bearish', 'neutral'
  impact_strength numeric NOT NULL DEFAULT 0.5, -- 0 to 1
  asset_id uuid REFERENCES public.assets(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  scheduled_for timestamp with time zone
);

ALTER TABLE public.news_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view news events"
ON public.news_events
FOR SELECT
USING (true);

-- Add more order types support
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_subtype text; -- 'ioc', 'fok', 'standard'

-- Add player stats table
CREATE TABLE IF NOT EXISTS public.player_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total_xp integer DEFAULT 0,
  level integer DEFAULT 1,
  achievements jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.player_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own stats"
ON public.player_stats
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own stats"
ON public.player_stats
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own stats"
ON public.player_stats
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Insert all assets from the provided list
-- CRYPTO ASSETS
INSERT INTO public.assets (name, symbol, asset_type, category, current_price, is_active) VALUES
('Bitcoin', 'BTC', 'crypto', 'crypto', 98000.00, true),
('Ethereum', 'ETH', 'crypto', 'crypto', 4200.00, true),
('Tether', 'USDT', 'crypto', 'crypto', 1.00, true),
('BNB', 'BNB', 'crypto', 'crypto', 980.00, true),
('Solana', 'SOL', 'crypto', 'crypto', 160.00, true),
('XRP', 'XRP', 'crypto', 'crypto', 4.10, true),
('USD Coin', 'USDC', 'crypto', 'crypto', 1.00, true),
('Dogecoin', 'DOGE', 'crypto', 'crypto', 0.20, true),
('Cardano', 'ADA', 'crypto', 'crypto', 1.20, true),
('Shiba Inu', 'SHIB', 'crypto', 'crypto', 0.000010, true)
ON CONFLICT (symbol) DO NOTHING;

-- STOCK ASSETS (sample - will add more in batches)
INSERT INTO public.assets (name, symbol, asset_type, category, current_price, is_active) VALUES
('Apple Inc.', 'AAPL', 'stock', 'stocks', 245.50, true),
('Microsoft Corp.', 'MSFT', 'stock', 'stocks', 480.20, true),
('Alphabet Inc.', 'GOOGL', 'stock', 'stocks', 195.80, true),
('Amazon.com Inc.', 'AMZN', 'stock', 'stocks', 210.30, true),
('NVIDIA Corp.', 'NVDA', 'stock', 'stocks', 130.10, true),
('Meta Platforms Inc.', 'META', 'stock', 'stocks', 580.60, true),
('Tesla Inc.', 'TSLA', 'stock', 'stocks', 280.90, true),
('Netflix Inc.', 'NFLX', 'stock', 'stocks', 720.50, true),
('Adobe Inc.', 'ADBE', 'stock', 'stocks', 580.90, true),
('Salesforce Inc.', 'CRM', 'stock', 'stocks', 320.80, true)
ON CONFLICT (symbol) DO NOTHING;

-- FOREX ASSETS
INSERT INTO public.assets (name, symbol, asset_type, category, current_price, is_active) VALUES
('Euro / US Dollar', 'EUR/USD', 'forex', 'forex', 1.0855, true),
('US Dollar / Japanese Yen', 'USD/JPY', 'forex', 'forex', 152.10, true),
('British Pound / US Dollar', 'GBP/USD', 'forex', 'forex', 1.2580, true),
('Australian Dollar / US Dollar', 'AUD/USD', 'forex', 'forex', 0.6590, true),
('US Dollar / Canadian Dollar', 'USD/CAD', 'forex', 'forex', 1.3420, true),
('US Dollar / Swiss Franc', 'USD/CHF', 'forex', 'forex', 0.9020, true),
('New Zealand Dollar / US Dollar', 'NZD/USD', 'forex', 'forex', 0.6050, true),
('Euro / British Pound', 'EUR/GBP', 'forex', 'forex', 0.8630, true),
('Euro / Japanese Yen', 'EUR/JPY', 'forex', 'forex', 165.10, true),
('British Pound / Japanese Yen', 'GBP/JPY', 'forex', 'forex', 191.00, true)
ON CONFLICT (symbol) DO NOTHING;