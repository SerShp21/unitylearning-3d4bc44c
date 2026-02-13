import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, BookOpen, User, Users } from "lucide-react";

const Classes = () => {
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", subject: "", description: "", teacher_id: "" });

  // Fetch all classes with teacher profiles
  const { data: classes = [] } = useQuery({
    queryKey: ["classes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("classes").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch teachers
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

  // Fetch students for enrollment
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

  // Fetch enrollments
  const { data: enrollments = [] } = useQuery({
    queryKey: ["enrollments"],
    queryFn: async () => {
      const { data } = await supabase.from("class_enrollments").select("*");
      return data ?? [];
    },
  });

  // Fetch all profiles for display
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
        name: form.name,
        subject: form.subject,
        description: form.description,
        teacher_id: form.teacher_id || null,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      queryClient.invalidateQueries({ queryKey: ["class-count"] });
      setForm({ name: "", subject: "", description: "", teacher_id: "" });
      setOpen(false);
      toast.success("Class created!");
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

  const getEnrolledStudents = (classId: string) => enrollments.filter(e => e.class_id === classId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Classes</h1>
          <p className="text-muted-foreground mt-1">
            {isAdmin ? "Create and manage classes" : "View your classes"}
          </p>
        </div>
        {isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" /> Create Class</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create New Class</DialogTitle></DialogHeader>
              <form onSubmit={e => { e.preventDefault(); createClass.mutate(); }} className="space-y-4">
                <div className="space-y-2">
                  <Label>Class Name</Label>
                  <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
                </div>
                <div className="space-y-2">
                  <Label>Subject</Label>
                  <Input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} required />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Assign Teacher</Label>
                  <Select value={form.teacher_id} onValueChange={v => setForm(f => ({ ...f, teacher_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select teacher" /></SelectTrigger>
                    <SelectContent>
                      {teachers.map(t => (
                        <SelectItem key={t.user_id} value={t.user_id}>{t.full_name || "Unnamed"}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full" disabled={createClass.isPending}>
                  {createClass.isPending ? "Creating..." : "Create Class"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {classes.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p>No classes yet.{isAdmin ? " Create one to get started." : ""}</p>
        </CardContent></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {classes.map(cls => {
            const enrolled = getEnrolledStudents(cls.id);
            return (
              <Card key={cls.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{cls.name}</CardTitle>
                      <CardDescription>{cls.subject}</CardDescription>
                    </div>
                    <Badge variant="secondary">{enrolled.length} students</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {cls.description && <p className="text-sm text-muted-foreground">{cls.description}</p>}
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{cls.teacher_id ? profileMap[cls.teacher_id] || "Unknown" : "No teacher"}</span>
                  </div>
                  {isAdmin && (
                    <Dialog open={enrollOpen && selectedClassId === cls.id} onOpenChange={v => { setEnrollOpen(v); if (v) setSelectedClassId(cls.id); }}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="w-full"><Users className="h-3.5 w-3.5 mr-1.5" /> Manage Students</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader><DialogTitle>Enroll Students — {cls.name}</DialogTitle></DialogHeader>
                        <div className="space-y-2 max-h-64 overflow-auto">
                          {students.map(s => {
                            const isEnrolled = enrolled.some(e => e.student_id === s.user_id);
                            return (
                              <div key={s.user_id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/50">
                                <span className="text-sm">{s.full_name || "Unnamed"}</span>
                                {isEnrolled ? (
                                  <Badge variant="secondary" className="text-xs">Enrolled</Badge>
                                ) : (
                                  <Button size="sm" variant="outline" onClick={() => enrollStudent.mutate(s.user_id)}>Enroll</Button>
                                )}
                              </div>
                            );
                          })}
                          {students.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No students found</p>}
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
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
