
-- Add timetable_entry_id to grades table
ALTER TABLE public.grades ADD COLUMN timetable_entry_id uuid REFERENCES public.timetable_entries(id) ON DELETE SET NULL;

-- Add timetable_entry_id to attendance table
ALTER TABLE public.attendance ADD COLUMN timetable_entry_id uuid REFERENCES public.timetable_entries(id) ON DELETE SET NULL;

-- Index for faster lookups
CREATE INDEX idx_grades_timetable_entry ON public.grades(timetable_entry_id);
CREATE INDEX idx_attendance_timetable_entry ON public.attendance(timetable_entry_id);
