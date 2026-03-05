
-- Drop overly permissive policies
DROP POLICY IF EXISTS "Authenticated users create invites" ON public.parent_invites;
DROP POLICY IF EXISTS "Anyone can update invites" ON public.parent_invites;

-- Only the student themselves or admins can create invites
CREATE POLICY "Students create own invites" ON public.parent_invites FOR INSERT TO authenticated WITH CHECK (student_id = auth.uid() OR is_admin(auth.uid()));

-- Only service role / edge functions update invites (via anon for token-based signup)
CREATE POLICY "Update pending invites by token" ON public.parent_invites FOR UPDATE TO authenticated USING (status = 'pending');
