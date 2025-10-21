-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule price updates every 10 seconds
-- Note: pg_cron uses cron syntax, minimum is 1 minute
-- We'll use pg_net to call the function every minute, but the function can be called more frequently from client
SELECT cron.schedule(
  'update-asset-prices',
  '*/1 * * * *', -- Every minute (pg_cron limitation)
  $$
  SELECT net.http_post(
    url:='https://agsgsdjobfpodjneknpm.supabase.co/functions/v1/update-asset-prices',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFnc2dzZGpvYmZwb2RqbmVrbnBtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1MTQwNzYsImV4cCI6MjA3NjA5MDA3Nn0.pMILTRvjd2ZLvPgcIjx1TwHQ4RsVwddepC4vQqmZKn0"}'::jsonb,
    body:='{}'::jsonb
  ) AS request_id;
  $$
);
