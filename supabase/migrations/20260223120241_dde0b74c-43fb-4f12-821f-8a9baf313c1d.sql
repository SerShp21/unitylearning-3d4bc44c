
-- Add publisher and ebook URL columns to classes
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS book_publisher text DEFAULT NULL;
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS book_ebook_url text DEFAULT NULL;

-- Create book-covers storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('book-covers', 'book-covers', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for book-covers
CREATE POLICY "Anyone can view book covers"
ON storage.objects FOR SELECT
USING (bucket_id = 'book-covers');

CREATE POLICY "Teachers and admins upload book covers"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'book-covers' AND (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'teacher'::app_role)));

CREATE POLICY "Teachers and admins delete book covers"
ON storage.objects FOR DELETE
USING (bucket_id = 'book-covers' AND (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'teacher'::app_role)));
