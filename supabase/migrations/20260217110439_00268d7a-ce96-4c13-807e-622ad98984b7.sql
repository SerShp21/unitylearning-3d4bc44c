
-- Add face_id column to profiles
ALTER TABLE public.profiles ADD COLUMN face_id text DEFAULT NULL;

-- Allow super_admin to update any profile (for face_id editing)
CREATE POLICY "Super admin updates any profile"
ON public.profiles
FOR UPDATE
USING (public.has_role(auth.uid(), 'super_admin'::app_role));

-- Allow super_admin to delete any profile
CREATE POLICY "Super admin deletes any profile"
ON public.profiles
FOR DELETE
USING (public.has_role(auth.uid(), 'super_admin'::app_role));

-- Allow super_admin to insert profiles (for user creation)
CREATE POLICY "Super admin inserts profiles"
ON public.profiles
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

-- Super admin can also manage all grades
CREATE POLICY "Super admin deletes grades"
ON public.grades
FOR DELETE
USING (public.has_role(auth.uid(), 'super_admin'::app_role));

-- Super admin can also manage all attendance
CREATE POLICY "Super admin deletes attendance"
ON public.attendance
FOR DELETE
USING (public.has_role(auth.uid(), 'super_admin'::app_role));

-- Super admin can manage all classes (already has admin policies, but ensure delete of classes works)
-- Super admin can manage all enrollments
CREATE POLICY "Super admin manages enrollments"
ON public.class_enrollments
FOR UPDATE
USING (public.has_role(auth.uid(), 'super_admin'::app_role));
