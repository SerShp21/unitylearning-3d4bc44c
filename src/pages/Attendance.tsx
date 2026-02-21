import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ClipboardList, Trash2, Check, X, Clock, ShieldCheck } from "lucide-react";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const STATUS_OPTIONS = ["present", "absent", "late", "excused"] as const;
const STATUS_COLORS: Record<string, string> = {
  present: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  absent: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  late: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  excused: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
};
const STATUS_ICONS: Record<string, React.ReactNode> = {
  present: <Check className="h-3 w-3" />,
  absent: <X className="h-3 w-3" />,
  late: <Clock className="h-3 w-3" />,
  excused: <ShieldCheck className="h-3 w-3" />,
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
    `${DAYS[entry.day_of_week] ?? "?"} ${entry.start_time?.slice(0, 5)}-${entry.end_time?.slice(0, 5)}${entry.room ? ` (${entry.room})` : ""}`;

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
    <div className="space-y-3 sm:space-y-5">
      {/* Header + filters inline */}
      <div className="space-y-2">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Attendance</h1>

        {/* Compact filter row */}
        <div className="flex flex-wrap gap-2 items-end">
          <Select value={selectedClass} onValueChange={v => { setSelectedClass(v); setSelectedEntry(""); }}>
            <SelectTrigger className="w-full sm:w-[180px] h-9 text-sm">
              <SelectValue placeholder="Select class" />
            </SelectTrigger>
            <SelectContent>
              {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>

          {selectedClass && entriesForClass.length > 0 && (
            <Select value={selectedEntry} onValueChange={setSelectedEntry}>
              <SelectTrigger className="w-full sm:w-[200px] h-9 text-sm">
                <SelectValue placeholder="All slots" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All slots</SelectItem>
                {entriesForClass.map(e => (
                  <SelectItem key={e.id} value={e.id}>{formatEntry(e)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="w-full sm:w-[160px] h-9 text-sm"
          />
        </div>
      </div>

      {/* Content */}
      {!selectedClass ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-8 text-center">
            <ClipboardList className="h-10 w-10 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">Select a class to view or mark attendance.</p>
          </CardContent>
        </Card>
      ) : canManage ? (
        /* Card-based student list for mobile-friendly marking */
        <div className="space-y-2">
          {studentsInClass.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground">No students enrolled</CardContent>
            </Card>
          ) : (
            studentsInClass.map(s => {
              const record = attendance.find(a => a.student_id === s.user_id);
              const currentStatus = record?.status || "unmarked";
              return (
                <Card key={s.user_id} className="overflow-hidden">
                  <CardContent className="p-3 sm:p-4 flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm truncate">{s.full_name}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Badge className={`text-[10px] px-1.5 ${STATUS_COLORS[currentStatus] || "bg-muted text-muted-foreground"}`}>
                          {currentStatus}
                        </Badge>
                        {isSuperAdmin && record && (
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive"
                            onClick={() => deleteAttendance.mutate(record.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      {STATUS_OPTIONS.map(status => (
                        <Button
                          key={status}
                          size="sm"
                          variant={currentStatus === status ? "default" : "outline"}
                          onClick={() => markAttendance.mutate({ studentId: s.user_id, status })}
                          disabled={markAttendance.isPending}
                          className="flex-1 text-[11px] capitalize h-8 gap-1 px-1"
                        >
                          {STATUS_ICONS[status]}
                          <span className="hidden xs:inline">{status}</span>
                          <span className="xs:hidden">{status.slice(0, 1).toUpperCase()}</span>
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      ) : (
        /* Student view - compact cards */
        <div className="space-y-2">
          {displayAttendance.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground">No attendance records</CardContent>
            </Card>
          ) : (
            displayAttendance.map(a => {
              const entry = a.timetable_entry_id ? timetableMap[a.timetable_entry_id] : null;
              return (
                <Card key={a.id}>
                  <CardContent className="p-3 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{classMap[a.class_id] || "—"}</p>
                      <p className="text-xs text-muted-foreground">
                        {a.date} {entry ? `· ${formatEntry(entry)}` : ""}
                      </p>
                    </div>
                    <Badge className={`shrink-0 text-[10px] ${STATUS_COLORS[a.status] || ""}`}>{a.status}</Badge>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export default Attendance;
