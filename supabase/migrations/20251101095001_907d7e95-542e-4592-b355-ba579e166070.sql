-- Add explicit deny policies for price_history table to prevent unauthorized modifications
-- Only the service role (used by edge functions) can modify price data

CREATE POLICY "Only service role can insert price history"
ON public.price_history
FOR INSERT
WITH CHECK (false);

CREATE POLICY "Only service role can update price history"
ON public.price_history
FOR UPDATE
USING (false);

CREATE POLICY "Only service role can delete price history"
ON public.price_history
FOR DELETE
USING (false);