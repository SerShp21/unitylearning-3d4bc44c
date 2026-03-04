import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bell, BookOpen, ClipboardList, GraduationCap, User } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  present: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  absent: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  late: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  excused: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
};

const ParentDashboard = () => {
  const { user } = useAuth();

  // Find students linked to this parent via parent_email
  const { data: linkedStudents = [], isLoading: loadingStudents } = useQuery({
    queryKey: ["parent-linked-students", user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url, gender")
        .eq("parent_email", user.email);
      return data ?? [];
    },
    enabled: !!user?.email,
  });

  const studentIds = linkedStudents.map(s => s.user_id);

  // Fetch grades for linked students
  const { data: grades = [] } = useQuery({
    queryKey: ["parent-grades", studentIds],
    queryFn: async () => {
      if (!studentIds.length) return [];
      const { data } = await supabase
        .from("grades")
        .select("*, classes(name)")
        .in("student_id", studentIds)
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
    enabled: studentIds.length > 0,
  });

  // Fetch attendance for linked students
  const { data: attendance = [] } = useQuery({
    queryKey: ["parent-attendance", studentIds],
    queryFn: async () => {
      if (!studentIds.length) return [];
      const { data } = await supabase
        .from("attendance")
        .select("*, classes(name)")
        .in("student_id", studentIds)
        .order("date", { ascending: false })
        .limit(50);
      return data ?? [];
    },
    enabled: studentIds.length > 0,
  });

  // Fetch notifications for this parent
  const { data: notifications = [] } = useQuery({
    queryKey: ["parent-notifications", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(30);
      return data ?? [];
    },
    enabled: !!user?.id,
  });

  const studentNameMap = Object.fromEntries(linkedStudents.map(s => [s.user_id, s.full_name]));

  const getScoreColor = (score: number, max: number) => {
    const pct = (score / max) * 100;
    if (pct >= 90) return "text-green-600";
    if (pct >= 70) return "text-yellow-600";
    return "text-red-600";
  };

  if (loadingStudents) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!linkedStudents.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <User className="h-16 w-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold">No Linked Students</h2>
        <p className="text-muted-foreground text-center max-w-md">
          No students are linked to your account yet. Ask the school administrator to set your email ({user?.email}) as the parent email in the student's profile.
        </p>
      </div>
    );
  }

  // Summary stats
  const totalAbsences = attendance.filter(a => a.status === "absent").length;
  const totalLate = attendance.filter(a => a.status === "late").length;
  const avgScore = grades.length > 0
    ? Math.round(grades.reduce((sum, g) => sum + (g.score / g.max_score) * 100, 0) / grades.length)
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Parent Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Monitoring {linkedStudents.map(s => s.full_name).join(", ")}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Children</p>
                <p className="text-2xl font-bold">{linkedStudents.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                <GraduationCap className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Score</p>
                <p className="text-2xl font-bold">{avgScore !== null ? `${avgScore}%` : "—"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                <ClipboardList className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Absences</p>
                <p className="text-2xl font-bold">{totalAbsences}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
                <Bell className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Late</p>
                <p className="text-2xl font-bold">{totalLate}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="grades" className="space-y-4">
        <TabsList>
          <TabsTrigger value="grades">Grades</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="grades">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5" /> Recent Grades</CardTitle></CardHeader>
            <CardContent>
              {grades.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No grades recorded yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead>Assignment</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {grades.map((g: any) => (
                      <TableRow key={g.id}>
                        <TableCell className="font-medium">{studentNameMap[g.student_id] || "Unknown"}</TableCell>
                        <TableCell>{g.classes?.name || "—"}</TableCell>
                        <TableCell>{g.title}</TableCell>
                        <TableCell>
                          <span className={`font-semibold ${getScoreColor(g.score, g.max_score)}`}>
                            {g.score}/{g.max_score}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{new Date(g.created_at).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attendance">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><ClipboardList className="h-5 w-5" /> Recent Attendance</CardTitle></CardHeader>
            <CardContent>
              {attendance.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No attendance records yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendance.map((a: any) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">{studentNameMap[a.student_id] || "Unknown"}</TableCell>
                        <TableCell>{a.classes?.name || "—"}</TableCell>
                        <TableCell>{a.date}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={STATUS_COLORS[a.status] || ""}>
                            {a.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5" /> Notifications</CardTitle></CardHeader>
            <CardContent>
              {notifications.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No notifications yet.</p>
              ) : (
                <div className="space-y-3">
                  {notifications.map((n: any) => (
                    <div key={n.id} className={`p-4 rounded-lg border ${n.read ? "bg-background" : "bg-muted/50 border-primary/20"}`}>
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-sm">{n.title}</p>
                          <p className="text-sm text-muted-foreground mt-1">{n.message}</p>
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap ml-4">
                          {new Date(n.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ParentDashboard;
