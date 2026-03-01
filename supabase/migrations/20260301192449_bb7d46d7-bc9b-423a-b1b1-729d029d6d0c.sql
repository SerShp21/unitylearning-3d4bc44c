
-- Add new columns to profiles for student onboarding
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS parent_email text,
  ADD COLUMN IF NOT EXISTS setup_completed boolean NOT NULL DEFAULT false;

-- Create index on parent_email for notification lookups
CREATE INDEX IF NOT EXISTS idx_profiles_parent_email ON public.profiles(parent_email);
