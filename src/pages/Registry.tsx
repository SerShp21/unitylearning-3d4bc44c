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
import { Plus, ClipboardList, Trash2, Check, X, Clock, ShieldCheck, Award, Pencil } from "lucide-react";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const STATUS_OPTIONS = ["present", "absent", "late", "excused"] as const;
const STATUS_COLORS: Record<string, string> = {
  present: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  absent: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  late: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  excused: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
};

const Registry = () => {
  const { user, isAdmin, isSuperAdmin, role } = useAuth();
  const queryClient = useQueryClient();
  const canManage = isAdmin || role === "teacher";
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedStudent, setSelectedStudent] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [gradeOpen, setGradeOpen] = useState(false);
  const [gradeForm, setGradeForm] = useState({ student_id: "", timetable_entry_id: "", title: "", score: "", max_score: "100", notes: "" });
  const [editGradeId, setEditGradeId] = useState<string | null>(null);
  const [editGradeOpen, setEditGradeOpen] = useState(false);

  const { data: classes = [] } = useQuery({
    queryKey: ["classes"],
    queryFn: async () => { const { data } = await supabase.from("classes").select("*").order("name"); return data ?? []; },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["all-profiles"],
    queryFn: async () => { const { data } = await supabase.from("profiles").select("user_id, full_name, parent_email, face_id"); return data ?? []; },
  });

  const { data: enrollments = [] } = useQuery({
    queryKey: ["enrollments"],
    queryFn: async () => { const { data } = await supabase.from("class_enrollments").select("*"); return data ?? []; },
  });

  const { data: timetableEntries = [] } = useQuery({
    queryKey: ["timetable"],
    queryFn: async () => { const { data } = await supabase.from("timetable_entries").select("*"); return data ?? []; },
  });

  const { data: attendance = [] } = useQuery({
    queryKey: ["attendance", selectedClass, selectedDate],
    queryFn: async () => {
      let q = supabase.from("attendance").select("*");
      if (selectedClass) q = q.eq("class_id", selectedClass);
      if (selectedDate) q = q.eq("date", selectedDate);
      const { data } = await q;
      return data ?? [];
    },
  });

  const { data: grades = [] } = useQuery({
    queryKey: ["grades", selectedClass],
    queryFn: async () => {
      let q = supabase.from("grades").select("*").order("created_at", { ascending: false });
      if (selectedClass) q = q.eq("class_id", selectedClass);
      const { data } = await q;
      return data ?? [];
    },
  });

  const profileMap = Object.fromEntries(profiles.map(p => [p.user_id, p.full_name]));
  const classMap = Object.fromEntries(classes.map(c => [c.id, c.name]));
  const timetableMap = Object.fromEntries(timetableEntries.map(t => [t.id, t]));

  const profileFullMap = Object.fromEntries(profiles.map(p => [p.user_id, p]));

  const studentsInClass = selectedClass
    ? enrollments.filter(e => e.class_id === selectedClass).map(e => ({ user_id: e.student_id, full_name: profileMap[e.student_id] || "Unknown" }))
    : [];

  const formatEntry = (entry: any) =>
    `${DAYS[entry.day_of_week] ?? "?"} ${entry.start_time?.slice(0, 5)}-${entry.end_time?.slice(0, 5)}${entry.room ? ` (${entry.room})` : ""}`;

  const entriesForClass = selectedClass ? timetableEntries.filter(e => e.class_id === selectedClass) : [];

  // Send parent notification (fire and forget)
  const notifyParent = async (type: string, studentId: string, details: Record<string, any>) => {
    const profile = profileFullMap[studentId];
    const parentEmail = (profile as any)?.parent_email;
    if (!parentEmail) return;
    try {
      await supabase.functions.invoke("notify-parent", {
        body: { type, parent_email: parentEmail, student_name: profile?.full_name || "Student", details },
      });
    } catch (err) {
      console.error("Failed to send parent notification:", err);
    }
  };

  // Mutations
  const markAttendance = useMutation({
    mutationFn: async ({ studentId, status }: { studentId: string; status: string }) => {
      const existing = attendance.find(a => a.student_id === studentId && a.class_id === selectedClass && a.date === selectedDate);
      if (existing) {
        const { error } = await supabase.from("attendance").update({ status }).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("attendance").insert({ class_id: selectedClass, student_id: studentId, date: selectedDate, status, marked_by: user!.id });
        if (error) throw error;
      }
      // Notify parent for absence/late
      if (status === "absent" || status === "late") {
        notifyParent("absence", studentId, { class_name: classMap[selectedClass] || "", date: selectedDate, status });
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["attendance"] }); toast.success("Attendance updated!"); },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteAttendance = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("attendance").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["attendance"] }); toast.success("Deleted!"); },
    onError: (err: any) => toast.error(err.message),
  });

  const createGrade = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("grades").insert({
        class_id: selectedClass, student_id: gradeForm.student_id,
        timetable_entry_id: gradeForm.timetable_entry_id || null,
        title: gradeForm.title, score: parseFloat(gradeForm.score), max_score: parseFloat(gradeForm.max_score),
        notes: gradeForm.notes || null, graded_by: user!.id,
      });
      if (error) throw error;
      // Notify parent about new grade
      notifyParent("grade", gradeForm.student_id, {
        title: gradeForm.title, score: gradeForm.score, max_score: gradeForm.max_score,
        class_name: classMap[selectedClass] || "",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grades"] });
      setGradeForm({ student_id: "", timetable_entry_id: "", title: "", score: "", max_score: "100", notes: "" });
      setGradeOpen(false);
      toast.success("Grade added!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateGrade = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("grades").update({
        title: gradeForm.title, score: parseFloat(gradeForm.score), max_score: parseFloat(gradeForm.max_score), notes: gradeForm.notes || null,
      }).eq("id", editGradeId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grades"] });
      setEditGradeOpen(false);
      setEditGradeId(null);
      toast.success("Grade updated!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteGrade = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("grades").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["grades"] }); toast.success("Grade deleted!"); },
    onError: (err: any) => toast.error(err.message),
  });

  const getScoreColor = (score: number, max: number) => {
    const pct = (score / max) * 100;
    if (pct >= 90) return "text-green-600";
    if (pct >= 70) return "text-yellow-600";
    return "text-red-600";
  };

  // Filter for student view
  const displayStudents = role === "student"
    ? studentsInClass.filter(s => s.user_id === user?.id)
    : selectedStudent ? studentsInClass.filter(s => s.user_id === selectedStudent) : studentsInClass;

  const displayGrades = role === "student"
    ? grades.filter(g => g.student_id === user?.id)
    : selectedStudent ? grades.filter(g => g.student_id === selectedStudent) : grades;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Registry</h1>
          <p className="text-sm text-muted-foreground">Attendance & grades in one place</p>
        </div>
        {canManage && selectedClass && (
          <Dialog open={gradeOpen} onOpenChange={setGradeOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Grade</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Grade</DialogTitle></DialogHeader>
              <form onSubmit={e => { e.preventDefault(); createGrade.mutate(); }} className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Student</Label>
                  <Select value={gradeForm.student_id} onValueChange={v => setGradeForm(f => ({ ...f, student_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
                    <SelectContent>{studentsInClass.map(s => <SelectItem key={s.user_id} value={s.user_id}>{s.full_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Slot (optional)</Label>
                  <Select value={gradeForm.timetable_entry_id} onValueChange={v => setGradeForm(f => ({ ...f, timetable_entry_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="No specific slot" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No specific slot</SelectItem>
                      {entriesForClass.map(e => <SelectItem key={e.id} value={e.id}>{formatEntry(e)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label>Title</Label><Input value={gradeForm.title} onChange={e => setGradeForm(f => ({ ...f, title: e.target.value }))} required /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5"><Label>Score</Label><Input type="number" value={gradeForm.score} onChange={e => setGradeForm(f => ({ ...f, score: e.target.value }))} required /></div>
                  <div className="space-y-1.5"><Label>Max</Label><Input type="number" value={gradeForm.max_score} onChange={e => setGradeForm(f => ({ ...f, max_score: e.target.value }))} required /></div>
                </div>
                <div className="space-y-1.5"><Label>Notes</Label><Input value={gradeForm.notes} onChange={e => setGradeForm(f => ({ ...f, notes: e.target.value }))} /></div>
                <Button type="submit" className="w-full" disabled={createGrade.isPending}>{createGrade.isPending ? "Adding..." : "Add Grade"}</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Edit grade dialog */}
      <Dialog open={editGradeOpen} onOpenChange={setEditGradeOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Grade</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); updateGrade.mutate(); }} className="space-y-3">
            <div className="space-y-1.5"><Label>Title</Label><Input value={gradeForm.title} onChange={e => setGradeForm(f => ({ ...f, title: e.target.value }))} required /></div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5"><Label>Score</Label><Input type="number" value={gradeForm.score} onChange={e => setGradeForm(f => ({ ...f, score: e.target.value }))} required /></div>
              <div className="space-y-1.5"><Label>Max</Label><Input type="number" value={gradeForm.max_score} onChange={e => setGradeForm(f => ({ ...f, max_score: e.target.value }))} required /></div>
            </div>
            <div className="space-y-1.5"><Label>Notes</Label><Input value={gradeForm.notes} onChange={e => setGradeForm(f => ({ ...f, notes: e.target.value }))} /></div>
            <Button type="submit" className="w-full" disabled={updateGrade.isPending}>{updateGrade.isPending ? "Saving..." : "Save"}</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-end">
        <Select value={selectedClass} onValueChange={v => { setSelectedClass(v); setSelectedStudent(""); }}>
          <SelectTrigger className="w-full sm:w-[180px] h-9 text-sm"><SelectValue placeholder="Select class" /></SelectTrigger>
          <SelectContent>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
        {selectedClass && role !== "student" && (
          <Select value={selectedStudent} onValueChange={setSelectedStudent}>
            <SelectTrigger className="w-full sm:w-[180px] h-9 text-sm"><SelectValue placeholder="All students" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All students</SelectItem>
              {studentsInClass.map(s => <SelectItem key={s.user_id} value={s.user_id}>{s.full_name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="w-full sm:w-[160px] h-9 text-sm" />
      </div>

      {!selectedClass ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-8 text-center">
            <ClipboardList className="h-10 w-10 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">Select a class to view the registry.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Attendance ({selectedDate})</TableHead>
                  <TableHead>Grades</TableHead>
                  {(isSuperAdmin || canManage) && <TableHead className="w-10"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayStudents.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No students</TableCell></TableRow>
                ) : displayStudents.map(s => {
                  const record = attendance.find(a => a.student_id === s.user_id);
                  const studentGrades = displayGrades.filter(g => g.student_id === s.user_id);
                  const currentStatus = record?.status || "unmarked";

                  return (
                    <TableRow key={s.user_id}>
                      <TableCell className="font-medium text-sm">{s.full_name}</TableCell>
                      <TableCell>
                        {canManage ? (
                          <div className="flex gap-1">
                            {STATUS_OPTIONS.map(status => (
                              <Button key={status} size="sm" variant={currentStatus === status ? "default" : "outline"}
                                onClick={() => markAttendance.mutate({ studentId: s.user_id, status })}
                                disabled={markAttendance.isPending} className="text-[10px] h-7 px-2 capitalize">
                                {status.slice(0, 1).toUpperCase()}
                              </Button>
                            ))}
                          </div>
                        ) : (
                          <Badge className={`text-[10px] ${STATUS_COLORS[currentStatus] || "bg-muted text-muted-foreground"}`}>{currentStatus}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {studentGrades.length === 0 ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {studentGrades.slice(0, 3).map(g => (
                              <Badge key={g.id} variant="secondary" className={`text-[10px] ${getScoreColor(g.score, g.max_score)}`}>
                                {g.title}: {g.score}/{g.max_score}
                              </Badge>
                            ))}
                            {studentGrades.length > 3 && <Badge variant="outline" className="text-[10px]">+{studentGrades.length - 3}</Badge>}
                          </div>
                        )}
                      </TableCell>
                      {(isSuperAdmin || canManage) && (
                        <TableCell>
                          <div className="flex gap-0.5">
                            {isSuperAdmin && record && (
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteAttendance.mutate(record.id)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
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

      {/* Grades detail table below */}
      {selectedClass && displayGrades.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="px-4 py-3 border-b">
              <h3 className="text-sm font-semibold flex items-center gap-2"><Award className="h-4 w-4" /> All Grades</h3>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  {role !== "student" && <TableHead>Student</TableHead>}
                  <TableHead>Score</TableHead>
                  <TableHead>%</TableHead>
                  <TableHead>Slot</TableHead>
                  <TableHead>Notes</TableHead>
                  {(isSuperAdmin || canManage) && <TableHead></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayGrades.map(g => {
                  const entry = g.timetable_entry_id ? timetableMap[g.timetable_entry_id] : null;
                  const pct = ((g.score / g.max_score) * 100).toFixed(1);
                  return (
                    <TableRow key={g.id}>
                      <TableCell className="font-medium text-sm">{g.title}</TableCell>
                      {role !== "student" && <TableCell className="text-sm">{profileMap[g.student_id] || "?"}</TableCell>}
                      <TableCell><span className={getScoreColor(g.score, g.max_score)}>{g.score}/{g.max_score}</span></TableCell>
                      <TableCell><Badge variant="secondary" className={getScoreColor(g.score, g.max_score)}>{pct}%</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{entry ? formatEntry(entry) : "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{g.notes || "—"}</TableCell>
                      {(isSuperAdmin || canManage) && (
                        <TableCell>
                          <div className="flex gap-0.5">
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => {
                              setEditGradeId(g.id);
                              setGradeForm({ student_id: g.student_id, timetable_entry_id: g.timetable_entry_id || "", title: g.title, score: String(g.score), max_score: String(g.max_score), notes: g.notes || "" });
                              setEditGradeOpen(true);
                            }}><Pencil className="h-3 w-3" /></Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteGrade.mutate(g.id)}>
                              <Trash2 className="h-3 w-3" />
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

export default Registry;
