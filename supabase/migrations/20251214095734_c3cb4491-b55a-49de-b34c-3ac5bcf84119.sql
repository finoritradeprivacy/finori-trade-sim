-- Add unique constraint on daily_challenges to prevent duplicate challenges per day
ALTER TABLE public.daily_challenges 
ADD CONSTRAINT daily_challenges_date_challenge_unique 
UNIQUE (challenge_date, challenge_id);