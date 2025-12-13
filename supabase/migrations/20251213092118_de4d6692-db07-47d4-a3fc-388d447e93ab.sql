-- Add cron job for generate-news (hourly)
SELECT cron.schedule(
  'generate-news-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://agsgsdjobfpodjneknpm.supabase.co/functions/v1/generate-news',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFnc2dzZGpvYmZwb2RqbmVrbnBtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1MTQwNzYsImV4cCI6MjA3NjA5MDA3Nn0.pMILTRvjd2ZLvPgcIjx1TwHQ4RsVwddepC4vQqmZKn0'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);