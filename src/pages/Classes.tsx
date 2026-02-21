import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, BookOpen, User, Users, Pencil, UserMinus, Trash2, GraduationCap } from "lucide-react";
import { ClassBookInfo } from "@/components/ClassBookInfo";

const Classes = () => {
  const { user, role, isAdmin, isSuperAdmin } = useAuth();
  const canEditBooks = isAdmin || role === "teacher";
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", subject: "", description: "", teacher_id: "" });
  const [renameForm, setRenameForm] = useState({ name: "", subject: "" });

  const { data: classes = [] } = useQuery({
    queryKey: ["classes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("classes").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: teachers = [] } = useQuery({
    queryKey: ["teachers"],
    queryFn: async () => {
      const { data: roleData } = await supabase.from("user_roles").select("user_id").eq("role", "teacher");
      if (!roleData?.length) return [];
      const ids = roleData.map(r => r.user_id);
      const { data } = await supabase.from("profiles").select("user_id, full_name").in("user_id", ids);
      return data ?? [];
    },
  });

  const { data: students = [] } = useQuery({
    queryKey: ["students"],
    queryFn: async () => {
      const { data: roleData } = await supabase.from("user_roles").select("user_id").eq("role", "student");
      if (!roleData?.length) return [];
      const ids = roleData.map(r => r.user_id);
      const { data } = await supabase.from("profiles").select("user_id, full_name").in("user_id", ids);
      return data ?? [];
    },
  });

  const { data: enrollments = [] } = useQuery({
    queryKey: ["enrollments"],
    queryFn: async () => {
      const { data } = await supabase.from("class_enrollments").select("*");
      return data ?? [];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["all-profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, full_name");
      return data ?? [];
    },
  });

  const profileMap = Object.fromEntries(profiles.map(p => [p.user_id, p.full_name]));

  const createClass = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("classes").insert({
        name: form.name, subject: form.subject, description: form.description,
        teacher_id: form.teacher_id || null, created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      setForm({ name: "", subject: "", description: "", teacher_id: "" });
      setOpen(false);
      toast.success("Class created!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const renameClass = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("classes").update({ name: renameForm.name, subject: renameForm.subject }).eq("id", selectedClassId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      setRenameOpen(false);
      toast.success("Class renamed!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteClass = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("classes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      toast.success("Class deleted!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const enrollStudent = useMutation({
    mutationFn: async (studentId: string) => {
      const { error } = await supabase.from("class_enrollments").insert({ class_id: selectedClassId!, student_id: studentId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enrollments"] });
      toast.success("Student enrolled!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const unenrollStudent = useMutation({
    mutationFn: async (enrollmentId: string) => {
      const { error } = await supabase.from("class_enrollments").delete().eq("id", enrollmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enrollments"] });
      toast.success("Student removed from class!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const getEnrolledStudents = (classId: string) => enrollments.filter(e => e.class_id === classId);
  const selectedClassName = selectedClassId ? classes.find(c => c.id === selectedClassId)?.name : "";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Classes</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {isAdmin ? "Create and manage your classes" : "View your enrolled classes"}
          </p>
        </div>
        {isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto gap-2 shadow-sm">
                <Plus className="h-4 w-4" /> New Class
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[95vw] sm:max-w-lg">
              <DialogHeader><DialogTitle>Create New Class</DialogTitle></DialogHeader>
              <form onSubmit={e => { e.preventDefault(); createClass.mutate(); }} className="space-y-4">
                <div className="space-y-2"><Label>Class Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="e.g. Year 10 English" /></div>
                <div className="space-y-2"><Label>Subject</Label><Input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} required placeholder="e.g. English Literature" /></div>
                <div className="space-y-2"><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional class description..." rows={3} /></div>
                <div className="space-y-2">
                  <Label>Assign Teacher</Label>
                  <Select value={form.teacher_id} onValueChange={v => setForm(f => ({ ...f, teacher_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select teacher" /></SelectTrigger>
                    <SelectContent>{teachers.map(t => <SelectItem key={t.user_id} value={t.user_id}>{t.full_name || "Unnamed"}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full" disabled={createClass.isPending}>{createClass.isPending ? "Creating..." : "Create Class"}</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Rename Dialog */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg">
          <DialogHeader><DialogTitle>Rename Class</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); renameClass.mutate(); }} className="space-y-4">
            <div className="space-y-2"><Label>Class Name</Label><Input value={renameForm.name} onChange={e => setRenameForm(f => ({ ...f, name: e.target.value }))} required /></div>
            <div className="space-y-2"><Label>Subject</Label><Input value={renameForm.subject} onChange={e => setRenameForm(f => ({ ...f, subject: e.target.value }))} required /></div>
            <Button type="submit" className="w-full" disabled={renameClass.isPending}>{renameClass.isPending ? "Saving..." : "Save Changes"}</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Manage Students Dialog */}
      <Dialog open={enrollOpen} onOpenChange={v => { setEnrollOpen(v); if (!v) setSelectedClassId(null); }}>
        <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[85vh] flex flex-col">
          <DialogHeader><DialogTitle className="text-base">Manage Students — {selectedClassName}</DialogTitle></DialogHeader>
          <div className="space-y-2 flex-1 overflow-auto -mx-2 px-2">
            {selectedClassId && (() => {
              const enrolled = getEnrolledStudents(selectedClassId);
              const available = students.filter(s => !enrolled.some(e => e.student_id === s.user_id));
              return (
                <>
                  {enrolled.length > 0 && (
                    <div className="space-y-1.5 mb-3">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Enrolled ({enrolled.length})</p>
                      {enrolled.map(e => (
                        <div key={e.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-muted/50 gap-2">
                          <span className="text-sm truncate">{profileMap[e.student_id] || "Unnamed"}</span>
                          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive h-7 px-2 shrink-0"
                            onClick={() => unenrollStudent.mutate(e.id)}>
                            <UserMinus className="h-3.5 w-3.5 mr-1" /> Remove
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Available ({available.length})</p>
                    {available.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">
                        {enrolled.length === 0 ? "No students found" : "All students enrolled"}
                      </p>
                    ) : (
                      available.map(s => (
                        <div key={s.user_id} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-muted/50 gap-2">
                          <span className="text-sm truncate">{s.full_name || "Unnamed"}</span>
                          <Button size="sm" variant="outline" className="shrink-0 h-7 px-3" onClick={() => enrollStudent.mutate(s.user_id)}>Enroll</Button>
                        </div>
                      ))
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>

      {/* Class Cards */}
      {classes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-10 text-center">
            <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <GraduationCap className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-lg font-medium mb-1">No classes yet</p>
            <p className="text-sm text-muted-foreground">{isAdmin ? "Create your first class to get started." : "You haven't been enrolled in any classes yet."}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {classes.map(cls => {
            const enrolled = getEnrolledStudents(cls.id);
            const teacherName = cls.teacher_id ? profileMap[cls.teacher_id] || "Unknown" : null;

            return (
              <Card key={cls.id} className="group relative overflow-hidden hover:shadow-lg transition-all duration-200 border-border/60">
                {/* Accent stripe */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-accent opacity-70" />

                <CardContent className="p-4 sm:p-5 pt-5 sm:pt-6 space-y-3">
                  {/* Title row */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-base sm:text-lg truncate leading-tight">{cls.name}</h3>
                      <p className="text-sm text-muted-foreground truncate mt-0.5">{cls.subject}</p>
                    </div>
                    {(isAdmin || isSuperAdmin) && (
                      <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        {isAdmin && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                            setSelectedClassId(cls.id);
                            setRenameForm({ name: cls.name, subject: cls.subject });
                            setRenameOpen(true);
                          }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {isSuperAdmin && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => { if (confirm(`Delete class "${cls.name}"?`)) deleteClass.mutate(cls.id); }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>

                  {cls.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">{cls.description}</p>
                  )}

                  {/* Info chips */}
                  <div className="flex flex-wrap items-center gap-2">
                    {teacherName && (
                      <div className="flex items-center gap-1.5 text-xs bg-muted/60 rounded-full px-2.5 py-1">
                        <User className="h-3 w-3 text-muted-foreground" />
                        <span className="truncate max-w-[120px]">{teacherName}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 text-xs bg-muted/60 rounded-full px-2.5 py-1">
                      <Users className="h-3 w-3 text-muted-foreground" />
                      <span>{enrolled.length} student{enrolled.length !== 1 ? "s" : ""}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-1.5 pt-1">
                    {isAdmin && (
                      <Button variant="outline" size="sm" className="w-full gap-1.5"
                        onClick={() => { setSelectedClassId(cls.id); setEnrollOpen(true); }}>
                        <Users className="h-3.5 w-3.5" /> Manage Students
                      </Button>
                    )}
                    <ClassBookInfo
                      classId={cls.id}
                      bookIsbn={cls.book_isbn ?? null}
                      bookTitle={cls.book_title ?? null}
                      bookAuthor={cls.book_author ?? null}
                      bookCoverUrl={cls.book_cover_url ?? null}
                      canEdit={canEditBooks}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Classes;
