-- =============================================
-- ADMIN PANEL - KOMPLETNÍ DATABÁZOVÁ STRUKTURA
-- =============================================

-- 1. AUDIT LOGS - Logování všech admin a user akcí
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index pro rychlé vyhledávání
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_action_type ON public.audit_logs(action_type);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Pouze admini mohou vidět audit logy
CREATE POLICY "Admins can view all audit logs"
ON public.audit_logs FOR SELECT
USING (is_admin());

-- Service role může vkládat
CREATE POLICY "Service can insert audit logs"
ON public.audit_logs FOR INSERT
WITH CHECK (true);

-- 2. USER SESSIONS - Historie přihlášení
CREATE TABLE public.user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ip_address TEXT,
  user_agent TEXT,
  device_type TEXT,
  location TEXT,
  logged_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  logged_out_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true
);

CREATE INDEX idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX idx_user_sessions_ip ON public.user_sessions(ip_address);
CREATE INDEX idx_user_sessions_active ON public.user_sessions(is_active) WHERE is_active = true;

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sessions"
ON public.user_sessions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all sessions"
ON public.user_sessions FOR SELECT
USING (is_admin());

CREATE POLICY "Service can insert sessions"
ON public.user_sessions FOR INSERT
WITH CHECK (true);

CREATE POLICY "Service can update sessions"
ON public.user_sessions FOR UPDATE
USING (true);

-- 3. USER BANS - Systém banů
CREATE TABLE public.user_bans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  banned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ban_type TEXT NOT NULL CHECK (ban_type IN ('temporary', 'permanent')),
  reason TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_bans_user_id ON public.user_bans(user_id);
CREATE INDEX idx_user_bans_active ON public.user_bans(is_active) WHERE is_active = true;

ALTER TABLE public.user_bans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage bans"
ON public.user_bans FOR ALL
USING (is_admin());

-- 4. IP BLOCKLIST
CREATE TABLE public.ip_blocklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address TEXT NOT NULL,
  reason TEXT,
  blocked_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_ip_blocklist_ip ON public.ip_blocklist(ip_address) WHERE is_active = true;

ALTER TABLE public.ip_blocklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage IP blocklist"
ON public.ip_blocklist FOR ALL
USING (is_admin());

-- 5. TRADING SETTINGS - Globální nastavení obchodování
CREATE TABLE public.trading_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.trading_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read trading settings"
ON public.trading_settings FOR SELECT
USING (true);

CREATE POLICY "Admins can update trading settings"
ON public.trading_settings FOR ALL
USING (is_admin());

-- Inicializace výchozích nastavení
INSERT INTO public.trading_settings (setting_key, setting_value, description) VALUES
('initial_balance', '100000'::jsonb, 'Počáteční kapitál pro nové uživatele'),
('max_leverage', '10'::jsonb, 'Maximální páka'),
('max_position_size', '50000'::jsonb, 'Maximální velikost jedné pozice'),
('max_open_positions', '20'::jsonb, 'Maximální počet otevřených pozic'),
('global_stop_loss_percent', '50'::jsonb, 'Globální stop-loss limit v procentech'),
('trading_fee_percent', '0.1'::jsonb, 'Poplatek za obchod v procentech'),
('markets_enabled', '{"crypto": true, "stocks": true, "forex": true}'::jsonb, 'Povolené trhy'),
('trading_hours', '{"enabled": false, "start": "09:00", "end": "17:00"}'::jsonb, 'Obchodní hodiny'),
('cooldown_after_loss_percent', '{"enabled": true, "threshold": 20, "duration_minutes": 30}'::jsonb, 'Cooldown po velkých ztrátách');

-- 6. USER RESTRICTIONS - Omezení pro jednotlivé uživatele
CREATE TABLE public.user_restrictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  restriction_type TEXT NOT NULL,
  restriction_value JSONB,
  reason TEXT,
  applied_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_restrictions_user_id ON public.user_restrictions(user_id);
CREATE INDEX idx_user_restrictions_active ON public.user_restrictions(is_active) WHERE is_active = true;

ALTER TABLE public.user_restrictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own restrictions"
ON public.user_restrictions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage restrictions"
ON public.user_restrictions FOR ALL
USING (is_admin());

-- 7. ADMIN NOTIFICATIONS - Notifikace pro adminy
CREATE TABLE public.admin_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  metadata JSONB DEFAULT '{}'::jsonb,
  is_read BOOLEAN DEFAULT false,
  read_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_notifications_unread ON public.admin_notifications(is_read) WHERE is_read = false;
CREATE INDEX idx_admin_notifications_severity ON public.admin_notifications(severity);
CREATE INDEX idx_admin_notifications_created ON public.admin_notifications(created_at DESC);

ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view notifications"
ON public.admin_notifications FOR SELECT
USING (is_admin());

CREATE POLICY "Admins can update notifications"
ON public.admin_notifications FOR UPDATE
USING (is_admin());

CREATE POLICY "Service can insert notifications"
ON public.admin_notifications FOR INSERT
WITH CHECK (true);

-- 8. PROMO CODES
CREATE TABLE public.promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  reward_type TEXT NOT NULL CHECK (reward_type IN ('usdt', 'xp', 'both')),
  reward_usdt NUMERIC DEFAULT 0,
  reward_xp INTEGER DEFAULT 0,
  max_uses INTEGER,
  current_uses INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active promo codes"
ON public.promo_codes FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage promo codes"
ON public.promo_codes FOR ALL
USING (is_admin());

-- 9. PROMO CODE REDEMPTIONS
CREATE TABLE public.promo_code_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id UUID NOT NULL REFERENCES public.promo_codes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(promo_code_id, user_id)
);

ALTER TABLE public.promo_code_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their redemptions"
ON public.promo_code_redemptions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all redemptions"
ON public.promo_code_redemptions FOR SELECT
USING (is_admin());

CREATE POLICY "Users can redeem codes"
ON public.promo_code_redemptions FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 10. SYSTEM ANNOUNCEMENTS
CREATE TABLE public.system_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  announcement_type TEXT NOT NULL CHECK (announcement_type IN ('info', 'warning', 'maintenance', 'promotion')),
  is_active BOOLEAN DEFAULT true,
  starts_at TIMESTAMPTZ DEFAULT now(),
  ends_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.system_announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active announcements"
ON public.system_announcements FOR SELECT
USING (is_active = true AND (starts_at IS NULL OR starts_at <= now()) AND (ends_at IS NULL OR ends_at > now()));

CREATE POLICY "Admins can manage announcements"
ON public.system_announcements FOR ALL
USING (is_admin());

-- 11. Enable realtime for admin notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_logs;

-- 12. Function to log admin actions
CREATE OR REPLACE FUNCTION public.log_admin_action(
  p_action_type TEXT,
  p_entity_type TEXT,
  p_entity_id TEXT DEFAULT NULL,
  p_details JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.audit_logs (user_id, action_type, entity_type, entity_id, details)
  VALUES (auth.uid(), p_action_type, p_entity_type, p_entity_id, p_details)
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

-- 13. Function to create admin notification
CREATE OR REPLACE FUNCTION public.create_admin_notification(
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_severity TEXT DEFAULT 'info',
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  INSERT INTO public.admin_notifications (notification_type, title, message, severity, metadata)
  VALUES (p_type, p_title, p_message, p_severity, p_metadata)
  RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$;

-- 14. Function to get trading setting
CREATE OR REPLACE FUNCTION public.get_trading_setting(p_key TEXT)
RETURNS JSONB
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT setting_value FROM public.trading_settings WHERE setting_key = p_key;
$$;

-- 15. Function to check if user is banned
CREATE OR REPLACE FUNCTION public.is_user_banned(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_bans
    WHERE user_id = p_user_id
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now())
  );
$$;

-- 16. Function to check if IP is blocked
CREATE OR REPLACE FUNCTION public.is_ip_blocked(p_ip TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.ip_blocklist
    WHERE ip_address = p_ip
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now())
  );
$$;

-- 17. Add moderator role check
CREATE OR REPLACE FUNCTION public.is_moderator()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin', 'moderator')
  )
$$;