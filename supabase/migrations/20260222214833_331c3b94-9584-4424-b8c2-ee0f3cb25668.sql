
-- Create lectures table
CREATE TABLE public.lectures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.lectures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view lectures" ON public.lectures FOR SELECT USING (true);
CREATE POLICY "Teachers and admins create lectures" ON public.lectures FOR INSERT WITH CHECK (is_admin(auth.uid()) OR has_role(auth.uid(), 'teacher'::app_role));
CREATE POLICY "Teachers and admins update lectures" ON public.lectures FOR UPDATE USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'teacher'::app_role));
CREATE POLICY "Teachers and admins delete lectures" ON public.lectures FOR DELETE USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'teacher'::app_role));

-- Create storage bucket for lecture files
INSERT INTO storage.buckets (id, name, public) VALUES ('lectures', 'lectures', true);

CREATE POLICY "Anyone can view lecture files" ON storage.objects FOR SELECT USING (bucket_id = 'lectures');
CREATE POLICY "Teachers and admins upload lecture files" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'lectures' AND (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'teacher'::app_role)));
CREATE POLICY "Teachers and admins delete lecture files" ON storage.objects FOR DELETE USING (bucket_id = 'lectures' AND (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'teacher'::app_role)));
