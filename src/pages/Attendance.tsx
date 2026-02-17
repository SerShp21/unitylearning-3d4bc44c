import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ClipboardList, Trash2 } from "lucide-react";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const STATUS_OPTIONS = ["present", "absent", "late", "excused"] as const;
const STATUS_COLORS: Record<string, string> = {
  present: "bg-green-100 text-green-800",
  absent: "bg-red-100 text-red-800",
  late: "bg-yellow-100 text-yellow-800",
  excused: "bg-blue-100 text-blue-800",
};

const Attendance = () => {
  const { user, isAdmin, isSuperAdmin, role } = useAuth();
  const queryClient = useQueryClient();
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [selectedEntry, setSelectedEntry] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);

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

  const { data: attendance = [] } = useQuery({
    queryKey: ["attendance", selectedClass, selectedEntry, selectedDate],
    queryFn: async () => {
      let query = supabase.from("attendance").select("*");
      if (selectedClass) query = query.eq("class_id", selectedClass);
      if (selectedEntry) query = query.eq("timetable_entry_id", selectedEntry);
      if (selectedDate) query = query.eq("date", selectedDate);
      const { data } = await query;
      return data ?? [];
    },
  });

  const profileMap = Object.fromEntries(profiles.map(p => [p.user_id, p.full_name]));
  const classMap = Object.fromEntries(classes.map(c => [c.id, c.name]));
  const timetableMap = Object.fromEntries(timetableEntries.map(t => [t.id, t]));

  const entriesForClass = selectedClass
    ? timetableEntries.filter(e => e.class_id === selectedClass)
    : [];

  const formatEntry = (entry: any) =>
    `${DAYS[entry.day_of_week] ?? "?"} ${entry.start_time}-${entry.end_time}${entry.room ? ` (${entry.room})` : ""}`;

  const studentsInClass = selectedClass
    ? enrollments.filter(e => e.class_id === selectedClass).map(e => ({
        user_id: e.student_id,
        full_name: profileMap[e.student_id] || "Unknown",
      }))
    : [];

  const markAttendance = useMutation({
    mutationFn: async ({ studentId, status }: { studentId: string; status: string }) => {
      const existing = attendance.find(
        a => a.student_id === studentId && a.class_id === selectedClass && a.date === selectedDate &&
          (selectedEntry ? a.timetable_entry_id === selectedEntry : true)
      );
      if (existing) {
        const { error } = await supabase.from("attendance").update({ status }).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("attendance").insert({
          class_id: selectedClass,
          student_id: studentId,
          date: selectedDate,
          status,
          marked_by: user!.id,
          timetable_entry_id: selectedEntry || null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      toast.success("Attendance updated!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteAttendance = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("attendance").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      toast.success("Attendance record deleted!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const displayAttendance = role === "student"
    ? attendance.filter(a => a.student_id === user?.id)
    : attendance;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Attendance</h1>
        <p className="text-muted-foreground mt-1">
          {canManage ? "Mark and manage attendance" : "View your attendance record"}
        </p>
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <Label>Class</Label>
          <Select value={selectedClass} onValueChange={v => { setSelectedClass(v); setSelectedEntry(""); }}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Select class" /></SelectTrigger>
            <SelectContent>
              {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {selectedClass && entriesForClass.length > 0 && (
          <div className="space-y-1">
            <Label>Timetable Slot</Label>
            <Select value={selectedEntry} onValueChange={setSelectedEntry}>
              <SelectTrigger className="w-[260px]"><SelectValue placeholder="All slots" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All slots</SelectItem>
                {entriesForClass.map(e => (
                  <SelectItem key={e.id} value={e.id}>{formatEntry(e)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-1">
          <Label>Date</Label>
          <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="w-[180px]" />
        </div>
      </div>

      {!selectedClass ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p>Select a class to view or mark attendance.</p>
        </CardContent></Card>
      ) : canManage ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {studentsInClass.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">No students enrolled</TableCell></TableRow>
                ) : (
                  studentsInClass.map(s => {
                    const record = attendance.find(a => a.student_id === s.user_id);
                    const currentStatus = record?.status || "unmarked";
                    return (
                      <TableRow key={s.user_id}>
                        <TableCell className="font-medium">{s.full_name}</TableCell>
                        <TableCell>
                          <Badge className={STATUS_COLORS[currentStatus] || "bg-muted text-muted-foreground"}>
                            {currentStatus}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1.5 flex-wrap items-center">
                            {STATUS_OPTIONS.map(status => (
                              <Button
                                key={status}
                                size="sm"
                                variant={currentStatus === status ? "default" : "outline"}
                                onClick={() => markAttendance.mutate({ studentId: s.user_id, status })}
                                disabled={markAttendance.isPending}
                                className="text-xs capitalize"
                              >
                                {status}
                              </Button>
                            ))}
                            {isSuperAdmin && record && (
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={() => deleteAttendance.mutate(record.id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Slot</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayAttendance.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">No attendance records</TableCell></TableRow>
                ) : (
                  displayAttendance.map(a => {
                    const entry = a.timetable_entry_id ? timetableMap[a.timetable_entry_id] : null;
                    return (
                      <TableRow key={a.id}>
                        <TableCell>{a.date}</TableCell>
                        <TableCell>{classMap[a.class_id] || "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {entry ? formatEntry(entry) : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge className={STATUS_COLORS[a.status] || ""}>{a.status}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Attendance;
