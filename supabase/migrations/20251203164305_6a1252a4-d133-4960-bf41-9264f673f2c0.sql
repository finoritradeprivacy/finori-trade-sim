-- =============================================
-- 1. USER ROLES SYSTEM FOR ADMIN ACCESS
-- =============================================

-- Create enum for roles
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (prevents recursive RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'admin'
  )
$$;

-- RLS policies for user_roles
CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (public.is_admin() OR user_id = auth.uid());

CREATE POLICY "Only admins can insert roles"
ON public.user_roles FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "Only admins can delete roles"
ON public.user_roles FOR DELETE
TO authenticated
USING (public.is_admin());

-- =============================================
-- 2. FIX TRADES TABLE - ADD TRIGGER TO CREATE TRADES
-- =============================================

-- Allow service role to insert trades
CREATE POLICY "Service role can insert trades"
ON public.trades FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Function to create trade record and update stats when order is filled
CREATE OR REPLACE FUNCTION public.handle_order_filled()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_realized_pnl NUMERIC := 0;
  v_avg_buy_price NUMERIC;
  v_is_profitable BOOLEAN;
BEGIN
  -- Only process when order becomes filled
  IF NEW.status = 'filled' AND (OLD IS NULL OR OLD.status != 'filled') THEN
    
    -- For sell orders, calculate realized PnL
    IF NEW.side = 'sell' THEN
      SELECT average_buy_price INTO v_avg_buy_price
      FROM portfolios
      WHERE user_id = NEW.user_id AND asset_id = NEW.asset_id;
      
      IF v_avg_buy_price IS NOT NULL THEN
        v_realized_pnl := (NEW.average_fill_price - v_avg_buy_price) * NEW.filled_quantity;
      END IF;
    END IF;
    
    -- Insert trade record
    INSERT INTO trades (order_id, user_id, asset_id, side, quantity, price, total_value, realized_pnl)
    VALUES (
      NEW.id,
      NEW.user_id,
      NEW.asset_id,
      NEW.side,
      NEW.filled_quantity,
      NEW.average_fill_price,
      NEW.filled_quantity * NEW.average_fill_price,
      v_realized_pnl
    );
    
    -- Update profile statistics
    v_is_profitable := (NEW.side = 'sell' AND v_realized_pnl > 0);
    
    UPDATE profiles
    SET 
      total_trades = total_trades + 1,
      total_profit_loss = total_profit_loss + v_realized_pnl,
      win_rate = CASE 
        WHEN total_trades = 0 THEN 
          CASE WHEN v_is_profitable THEN 100 ELSE 0 END
        ELSE
          (win_rate * total_trades + CASE WHEN v_is_profitable THEN 100 ELSE 0 END) / (total_trades + 1)
      END
    WHERE id = NEW.user_id;
    
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on orders table
DROP TRIGGER IF EXISTS on_order_filled ON orders;
CREATE TRIGGER on_order_filled
  AFTER INSERT OR UPDATE OF status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION handle_order_filled();

-- =============================================
-- 3. ADMIN VIEW POLICIES
-- =============================================

-- Allow admins to view all profiles
CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (public.is_admin() OR auth.uid() = id);

-- Allow admins to update all profiles (for reset)
CREATE POLICY "Admins can update all profiles"
ON public.profiles FOR UPDATE
TO authenticated
USING (public.is_admin());

-- Allow admins to view all balances
CREATE POLICY "Admins can view all balances"
ON public.user_balances FOR SELECT
TO authenticated
USING (public.is_admin() OR auth.uid() = user_id);

-- Allow admins to update all balances (for reset)
CREATE POLICY "Admins can update all balances"
ON public.user_balances FOR UPDATE
TO authenticated
USING (public.is_admin());

-- Allow admins to view all player stats
CREATE POLICY "Admins can view all player stats"
ON public.player_stats FOR SELECT
TO authenticated
USING (public.is_admin() OR auth.uid() = user_id);

-- Allow admins to update all player stats (for reset)
CREATE POLICY "Admins can update all player stats"
ON public.player_stats FOR UPDATE
TO authenticated
USING (public.is_admin());

-- Allow admins to view all orders
CREATE POLICY "Admins can view all orders"
ON public.orders FOR SELECT
TO authenticated
USING (public.is_admin() OR auth.uid() = user_id);

-- Allow admins to delete orders (for reset)
CREATE POLICY "Admins can delete orders"
ON public.orders FOR DELETE
TO authenticated
USING (public.is_admin());

-- Allow admins to view all portfolios
CREATE POLICY "Admins can view all portfolios"
ON public.portfolios FOR SELECT
TO authenticated
USING (public.is_admin() OR auth.uid() = user_id);

-- Allow admins to delete portfolios (for reset)
CREATE POLICY "Admins can delete portfolios"
ON public.portfolios FOR DELETE
TO authenticated
USING (public.is_admin());

-- Allow admins to view all trades
CREATE POLICY "Admins can view all trades"
ON public.trades FOR SELECT
TO authenticated
USING (public.is_admin() OR auth.uid() = user_id);

-- Allow admins to delete trades (for reset)
CREATE POLICY "Admins can delete trades"
ON public.trades FOR DELETE
TO authenticated
USING (public.is_admin());

-- =============================================
-- 4. BACKFILL EXISTING DATA
-- =============================================

-- Create trades from existing filled orders
INSERT INTO trades (order_id, user_id, asset_id, side, quantity, price, total_value, realized_pnl, created_at)
SELECT 
  o.id,
  o.user_id,
  o.asset_id,
  o.side,
  o.filled_quantity,
  o.average_fill_price,
  o.filled_quantity * o.average_fill_price,
  0,
  o.filled_at
FROM orders o
WHERE o.status = 'filled'
AND NOT EXISTS (SELECT 1 FROM trades t WHERE t.order_id = o.id);

-- Update profile statistics from existing orders
WITH trade_stats AS (
  SELECT 
    user_id,
    COUNT(*) as trade_count,
    COUNT(*) FILTER (WHERE side = 'sell' AND realized_pnl > 0) as winning_trades,
    COALESCE(SUM(realized_pnl), 0) as total_pnl
  FROM trades
  GROUP BY user_id
)
UPDATE profiles p
SET 
  total_trades = ts.trade_count,
  total_profit_loss = ts.total_pnl,
  win_rate = CASE 
    WHEN ts.trade_count > 0 THEN (ts.winning_trades::numeric / ts.trade_count * 100)
    ELSE 0 
  END
FROM trade_stats ts
WHERE p.id = ts.user_id;