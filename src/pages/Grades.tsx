import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, GraduationCap, Trash2, Pencil } from "lucide-react";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const Grades = () => {
  const { user, isAdmin, isSuperAdmin, role } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [form, setForm] = useState({ class_id: "", student_id: "", timetable_entry_id: "", title: "", score: "", max_score: "100", notes: "" });

  const canManage = isAdmin || role === "teacher";

  const { data: classes = [] } = useQuery({
    queryKey: ["classes"],
    queryFn: async () => {
      const { data } = await supabase.from("classes").select("*").order("name");
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

  const { data: enrollments = [] } = useQuery({
    queryKey: ["enrollments"],
    queryFn: async () => {
      const { data } = await supabase.from("class_enrollments").select("*");
      return data ?? [];
    },
  });

  const { data: timetableEntries = [] } = useQuery({
    queryKey: ["timetable"],
    queryFn: async () => {
      const { data } = await supabase.from("timetable_entries").select("*");
      return data ?? [];
    },
  });

  const { data: grades = [] } = useQuery({
    queryKey: ["grades", selectedClass],
    queryFn: async () => {
      let query = supabase.from("grades").select("*").order("created_at", { ascending: false });
      if (selectedClass) query = query.eq("class_id", selectedClass);
      const { data } = await query;
      return data ?? [];
    },
  });

  const profileMap = Object.fromEntries(profiles.map(p => [p.user_id, p.full_name]));
  const classMap = Object.fromEntries(classes.map(c => [c.id, c.name]));
  const timetableMap = Object.fromEntries(timetableEntries.map(t => [t.id, t]));

  const entriesForClass = (classId: string) =>
    timetableEntries.filter(e => e.class_id === classId);

  const studentsInClass = (classId: string) =>
    enrollments.filter(e => e.class_id === classId).map(e => ({
      user_id: e.student_id,
      full_name: profileMap[e.student_id] || "Unknown",
    }));

  const formatEntry = (entry: any) =>
    `${DAYS[entry.day_of_week] ?? "?"} ${entry.start_time}-${entry.end_time}${entry.room ? ` (${entry.room})` : ""}`;

  const createGrade = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("grades").insert({
        class_id: form.class_id, student_id: form.student_id,
        timetable_entry_id: form.timetable_entry_id || null,
        title: form.title, score: parseFloat(form.score), max_score: parseFloat(form.max_score),
        notes: form.notes || null, graded_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grades"] });
      setForm({ class_id: "", student_id: "", timetable_entry_id: "", title: "", score: "", max_score: "100", notes: "" });
      setOpen(false);
      toast.success("Grade added!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateGrade = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("grades").update({
        title: form.title, score: parseFloat(form.score), max_score: parseFloat(form.max_score), notes: form.notes || null,
      }).eq("id", editingId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grades"] });
      setEditOpen(false);
      setEditingId(null);
      toast.success("Grade updated!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteGrade = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("grades").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grades"] });
      toast.success("Grade deleted!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const openEdit = (g: any) => {
    setEditingId(g.id);
    setForm({ class_id: g.class_id, student_id: g.student_id, timetable_entry_id: g.timetable_entry_id || "", title: g.title, score: String(g.score), max_score: String(g.max_score), notes: g.notes || "" });
    setEditOpen(true);
  };

  const getScoreColor = (score: number, max: number) => {
    const pct = (score / max) * 100;
    if (pct >= 90) return "text-green-600";
    if (pct >= 70) return "text-yellow-600";
    return "text-red-600";
  };

  const displayGrades = role === "student" ? grades.filter(g => g.student_id === user?.id) : grades;

  const gradeForm = (onSubmit: () => void, isPending: boolean, label: string, isEdit = false) => (
    <form onSubmit={e => { e.preventDefault(); onSubmit(); }} className="space-y-4">
      {!isEdit && (
        <>
          <div className="space-y-2">
            <Label>Class</Label>
            <Select value={form.class_id} onValueChange={v => setForm(f => ({ ...f, class_id: v, student_id: "", timetable_entry_id: "" }))}>
              <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
              <SelectContent>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {form.class_id && (
            <>
              <div className="space-y-2">
                <Label>Timetable Slot</Label>
                <Select value={form.timetable_entry_id} onValueChange={v => setForm(f => ({ ...f, timetable_entry_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select slot (optional)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No specific slot</SelectItem>
                    {entriesForClass(form.class_id).map(e => <SelectItem key={e.id} value={e.id}>{formatEntry(e)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Student</Label>
                <Select value={form.student_id} onValueChange={v => setForm(f => ({ ...f, student_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
                  <SelectContent>{studentsInClass(form.class_id).map(s => <SelectItem key={s.user_id} value={s.user_id}>{s.full_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </>
          )}
        </>
      )}
      <div className="space-y-2">
        <Label>Assignment Title</Label>
        <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Score</Label>
          <Input type="number" value={form.score} onChange={e => setForm(f => ({ ...f, score: e.target.value }))} required />
        </div>
        <div className="space-y-2">
          <Label>Max Score</Label>
          <Input type="number" value={form.max_score} onChange={e => setForm(f => ({ ...f, max_score: e.target.value }))} required />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Notes (optional)</Label>
        <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
      </div>
      <Button type="submit" className="w-full" disabled={isPending}>{isPending ? "Saving..." : label}</Button>
    </form>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Grades</h1>
          <p className="text-muted-foreground mt-1">{canManage ? "Manage student grades" : "View your grades"}</p>
        </div>
        {canManage && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> Add Grade</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Grade</DialogTitle></DialogHeader>
              {gradeForm(() => createGrade.mutate(), createGrade.isPending, "Add Grade")}
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Grade</DialogTitle></DialogHeader>
          {gradeForm(() => updateGrade.mutate(), updateGrade.isPending, "Save Changes", true)}
        </DialogContent>
      </Dialog>

      <div className="flex gap-3 items-center">
        <Label>Filter by class:</Label>
        <Select value={selectedClass} onValueChange={setSelectedClass}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="All classes" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All classes</SelectItem>
            {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {displayGrades.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          <GraduationCap className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p>No grades recorded yet.</p>
        </CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Assignment</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Slot</TableHead>
                  {role !== "student" && <TableHead>Student</TableHead>}
                  <TableHead>Score</TableHead>
                  <TableHead>Percentage</TableHead>
                  <TableHead>Notes</TableHead>
                  {(isSuperAdmin || canManage) && <TableHead>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayGrades.map(g => {
                  const pct = ((g.score / g.max_score) * 100).toFixed(1);
                  const entry = g.timetable_entry_id ? timetableMap[g.timetable_entry_id] : null;
                  return (
                    <TableRow key={g.id}>
                      <TableCell className="font-medium">{g.title}</TableCell>
                      <TableCell>{classMap[g.class_id] || "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{entry ? formatEntry(entry) : "—"}</TableCell>
                      {role !== "student" && <TableCell>{profileMap[g.student_id] || "Unknown"}</TableCell>}
                      <TableCell><span className={getScoreColor(g.score, g.max_score)}>{g.score}/{g.max_score}</span></TableCell>
                      <TableCell><Badge variant="secondary" className={getScoreColor(g.score, g.max_score)}>{pct}%</Badge></TableCell>
                      <TableCell className="text-muted-foreground text-sm">{g.notes || "—"}</TableCell>
                      {(isSuperAdmin || canManage) && (
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(g)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => deleteGrade.mutate(g.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Grades;
