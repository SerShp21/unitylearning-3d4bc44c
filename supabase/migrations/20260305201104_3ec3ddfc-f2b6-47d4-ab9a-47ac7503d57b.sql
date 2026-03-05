
CREATE TABLE public.parent_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  parent_phone text NOT NULL,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  status text NOT NULL DEFAULT 'pending',
  parent_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz
);

ALTER TABLE public.parent_invites ENABLE ROW LEVEL SECURITY;

-- Anyone can read invites (needed for token lookup during signup)
CREATE POLICY "Anyone can view invites" ON public.parent_invites FOR SELECT USING (true);

-- Authenticated users can insert (students create invites during onboarding)
CREATE POLICY "Authenticated users create invites" ON public.parent_invites FOR INSERT TO authenticated WITH CHECK (true);

-- Allow updating invite status (when parent accepts)
CREATE POLICY "Anyone can update invites" ON public.parent_invites FOR UPDATE USING (true);
