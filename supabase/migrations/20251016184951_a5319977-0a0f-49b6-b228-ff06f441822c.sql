-- Add category to assets if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'assets' AND column_name = 'category') THEN
    ALTER TABLE public.assets ADD COLUMN category text NOT NULL DEFAULT 'crypto';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'assets' AND column_name = 'description') THEN
    ALTER TABLE public.assets ADD COLUMN description text;
  END IF;
END $$;

-- Create news_events table if not exists
CREATE TABLE IF NOT EXISTS public.news_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  headline text NOT NULL,
  content text NOT NULL,
  event_type text NOT NULL,
  impact_type text NOT NULL,
  impact_strength numeric NOT NULL DEFAULT 0.5,
  asset_id uuid REFERENCES public.assets(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  scheduled_for timestamp with time zone
);

ALTER TABLE public.news_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'news_events' AND policyname = 'Anyone can view news events'
  ) THEN
    CREATE POLICY "Anyone can view news events" ON public.news_events FOR SELECT USING (true);
  END IF;
END $$;

-- Add order subtype if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'orders' AND column_name = 'order_subtype') THEN
    ALTER TABLE public.orders ADD COLUMN order_subtype text DEFAULT 'standard';
  END IF;
END $$;

-- Create player_stats table if not exists
CREATE TABLE IF NOT EXISTS public.player_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  total_xp integer DEFAULT 0,
  level integer DEFAULT 1,
  achievements jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.player_stats ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'player_stats' AND policyname = 'Users can view their own stats') THEN
    CREATE POLICY "Users can view their own stats" ON public.player_stats FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'player_stats' AND policyname = 'Users can update their own stats') THEN
    CREATE POLICY "Users can update their own stats" ON public.player_stats FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'player_stats' AND policyname = 'Users can insert their own stats') THEN
    CREATE POLICY "Users can insert their own stats" ON public.player_stats FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Update existing assets to have categories
UPDATE public.assets SET category = 'crypto' WHERE asset_type = 'crypto' AND category IS NULL;

-- Insert sample assets (will add more in future updates)
INSERT INTO public.assets (name, symbol, asset_type, category, current_price, is_active, market_cap, volume_24h, price_change_24h) VALUES
('Bitcoin', 'BTC', 'crypto', 'crypto', 98000.00, true, 1900000000000, 45000000000, 2.5),
('Ethereum', 'ETH', 'crypto', 'crypto', 4200.00, true, 500000000000, 20000000000, 1.8),
('Solana', 'SOL', 'crypto', 'crypto', 160.00, true, 70000000000, 3000000000, 3.2),
('XRP', 'XRP', 'crypto', 'crypto', 4.10, true, 220000000000, 8000000000, -0.5),
('Cardano', 'ADA', 'crypto', 'crypto', 1.20, true, 42000000000, 1500000000, 1.1),
('Apple Inc.', 'AAPL', 'stock', 'stocks', 245.50, true, 3800000000000, 85000000000, 0.8),
('Microsoft Corp.', 'MSFT', 'stock', 'stocks', 480.20, true, 3600000000000, 45000000000, 1.2),
('NVIDIA Corp.', 'NVDA', 'stock', 'stocks', 130.10, true, 3200000000000, 65000000000, 2.8),
('Tesla Inc.', 'TSLA', 'stock', 'stocks', 280.90, true, 900000000000, 38000000000, -1.5),
('Meta Platforms', 'META', 'stock', 'stocks', 580.60, true, 1500000000000, 28000000000, 0.9),
('Euro / US Dollar', 'EUR/USD', 'forex', 'forex', 1.0855, true, 0, 500000000000, 0.15),
('US Dollar / Japanese Yen', 'USD/JPY', 'forex', 'forex', 152.10, true, 0, 450000000000, -0.08),
('British Pound / US Dollar', 'GBP/USD', 'forex', 'forex', 1.2580, true, 0, 380000000000, 0.22),
('Australian Dollar / US Dollar', 'AUD/USD', 'forex', 'forex', 0.6590, true, 0, 180000000000, -0.12),
('US Dollar / Canadian Dollar', 'USD/CAD', 'forex', 'forex', 1.3420, true, 0, 220000000000, 0.05)
ON CONFLICT (symbol) DO UPDATE SET 
  current_price = EXCLUDED.current_price,
  category = EXCLUDED.category,
  market_cap = EXCLUDED.market_cap,
  volume_24h = EXCLUDED.volume_24h,
  price_change_24h = EXCLUDED.price_change_24h;