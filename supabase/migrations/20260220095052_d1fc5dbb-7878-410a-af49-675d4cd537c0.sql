
-- Fix: DROP restrictive SELECT policies and recreate as PERMISSIVE

-- user_roles
DROP POLICY IF EXISTS "Anyone can view roles" ON public.user_roles;
CREATE POLICY "Anyone can view roles"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (true);

-- profiles
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;
CREATE POLICY "Anyone can view profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- class_enrollments
DROP POLICY IF EXISTS "Anyone can view enrollments" ON public.class_enrollments;
CREATE POLICY "Anyone can view enrollments"
  ON public.class_enrollments
  FOR SELECT
  TO authenticated
  USING (true);

-- classes
DROP POLICY IF EXISTS "Anyone can view classes" ON public.classes;
CREATE POLICY "Anyone can view classes"
  ON public.classes
  FOR SELECT
  TO authenticated
  USING (true);
