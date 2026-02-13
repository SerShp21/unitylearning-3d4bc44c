
-- Grades table
CREATE TABLE public.grades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  title text NOT NULL,
  score numeric NOT NULL,
  max_score numeric NOT NULL DEFAULT 100,
  notes text,
  graded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view grades" ON public.grades FOR SELECT USING (true);
CREATE POLICY "Admins and teachers create grades" ON public.grades FOR INSERT WITH CHECK (is_admin(auth.uid()) OR has_role(auth.uid(), 'teacher'));
CREATE POLICY "Admins and teachers update grades" ON public.grades FOR UPDATE USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'teacher'));
CREATE POLICY "Admins and teachers delete grades" ON public.grades FOR DELETE USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'teacher'));

CREATE TRIGGER update_grades_updated_at BEFORE UPDATE ON public.grades FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Attendance table
CREATE TABLE public.attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'absent', 'late', 'excused')),
  notes text,
  marked_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(class_id, student_id, date)
);

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view attendance" ON public.attendance FOR SELECT USING (true);
CREATE POLICY "Admins and teachers create attendance" ON public.attendance FOR INSERT WITH CHECK (is_admin(auth.uid()) OR has_role(auth.uid(), 'teacher'));
CREATE POLICY "Admins and teachers update attendance" ON public.attendance FOR UPDATE USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'teacher'));
CREATE POLICY "Admins and teachers delete attendance" ON public.attendance FOR DELETE USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'teacher'));
