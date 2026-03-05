import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, TrendingUp, AlertTriangle, Clock, BookOpen, ClipboardList, Bell } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  present: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  absent: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  late: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  excused: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
};

const ParentDashboard = () => {
  const { user } = useAuth();

  const { data: linkedStudents = [], isLoading } = useQuery({
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

  const { data: grades = [] } = useQuery({
    queryKey: ["parent-grades", studentIds],
    queryFn: async () => {
      if (!studentIds.length) return [];
      const { data } = await supabase.from("grades").select("*, classes(name)")
        .in("student_id", studentIds).order("created_at", { ascending: false }).limit(30);
      return data ?? [];
    },
    enabled: studentIds.length > 0,
  });

  const { data: attendance = [] } = useQuery({
    queryKey: ["parent-attendance", studentIds],
    queryFn: async () => {
      if (!studentIds.length) return [];
      const { data } = await supabase.from("attendance").select("*, classes(name)")
        .in("student_id", studentIds).order("date", { ascending: false }).limit(30);
      return data ?? [];
    },
    enabled: studentIds.length > 0,
  });

  const { data: notifications = [] } = useQuery({
    queryKey: ["parent-notifications", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase.from("notifications").select("*")
        .eq("user_id", user.id).order("created_at", { ascending: false }).limit(20);
      return data ?? [];
    },
    enabled: !!user?.id,
  });

  if (isLoading) {
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
        <p className="text-muted-foreground text-center max-w-md text-sm">
          No students are linked to your account yet. Your child needs to add your phone number during their account setup.
        </p>
      </div>
    );
  }

  const studentNameMap = Object.fromEntries(linkedStudents.map(s => [s.user_id, s.full_name]));
  const totalAbsences = attendance.filter(a => a.status === "absent").length;
  const totalLate = attendance.filter(a => a.status === "late").length;
  const avgScore = grades.length > 0
    ? Math.round(grades.reduce((sum, g) => sum + (g.score / g.max_score) * 100, 0) / grades.length)
    : null;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Welcome, Parent</h1>
        <p className="text-sm text-muted-foreground">
          Monitoring: {linkedStudents.map(s => s.full_name).join(", ")}
        </p>
      </div>

      {/* Key Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={User} label="Children" value={linkedStudents.length} color="primary" />
        <StatCard icon={TrendingUp} label="Avg Score" value={avgScore !== null ? `${avgScore}%` : "—"} color="green" />
        <StatCard icon={AlertTriangle} label="Absences" value={totalAbsences} color="red" />
        <StatCard icon={Clock} label="Late" value={totalLate} color="yellow" />
      </div>

      {/* Content Tabs */}
      <Tabs defaultValue="grades" className="space-y-4">
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="grades" className="gap-1.5"><BookOpen className="h-3.5 w-3.5 hidden sm:block" />Grades</TabsTrigger>
          <TabsTrigger value="attendance" className="gap-1.5"><ClipboardList className="h-3.5 w-3.5 hidden sm:block" />Attendance</TabsTrigger>
          <TabsTrigger value="alerts" className="gap-1.5"><Bell className="h-3.5 w-3.5 hidden sm:block" />Alerts</TabsTrigger>
        </TabsList>

        <TabsContent value="grades">
          {grades.length === 0 ? (
            <EmptyState icon={BookOpen} text="No grades recorded yet." />
          ) : (
            <div className="space-y-2">
              {grades.map((g: any) => {
                const pct = Math.round((g.score / g.max_score) * 100);
                const color = pct >= 90 ? "text-green-600" : pct >= 70 ? "text-yellow-600" : "text-red-600";
                return (
                  <Card key={g.id} className="border">
                    <CardContent className="py-3 px-4 flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{g.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {studentNameMap[g.student_id]} · {g.classes?.name || "—"} · {new Date(g.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right ml-3 shrink-0">
                        <p className={`font-bold text-lg ${color}`}>{g.score}/{g.max_score}</p>
                        <p className={`text-xs font-medium ${color}`}>{pct}%</p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="attendance">
          {attendance.length === 0 ? (
            <EmptyState icon={ClipboardList} text="No attendance records yet." />
          ) : (
            <div className="space-y-2">
              {attendance.map((a: any) => (
                <Card key={a.id} className="border">
                  <CardContent className="py-3 px-4 flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm">{studentNameMap[a.student_id]}</p>
                      <p className="text-xs text-muted-foreground">{a.classes?.name || "—"} · {a.date}</p>
                    </div>
                    <Badge variant="outline" className={`${STATUS_COLORS[a.status] || ""} capitalize shrink-0`}>
                      {a.status}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="alerts">
          {notifications.length === 0 ? (
            <EmptyState icon={Bell} text="No notifications yet." />
          ) : (
            <div className="space-y-2">
              {notifications.map((n: any) => (
                <Card key={n.id} className={`border ${!n.read ? "border-primary/30 bg-primary/5" : ""}`}>
                  <CardContent className="py-3 px-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-sm">{n.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                      </div>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap mt-0.5">
                        {new Date(n.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

const StatCard = ({ icon: Icon, label, value, color }: { icon: any; label: string; value: string | number; color: string }) => {
  const colorMap: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    green: "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400",
    red: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
    yellow: "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400",
  };
  return (
    <Card>
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-center gap-2.5">
          <div className={`p-1.5 rounded-lg ${colorMap[color]}`}><Icon className="h-4 w-4" /></div>
          <div>
            <p className="text-[11px] text-muted-foreground leading-none">{label}</p>
            <p className="text-xl font-bold mt-0.5">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const EmptyState = ({ icon: Icon, text }: { icon: any; text: string }) => (
  <Card>
    <CardContent className="flex flex-col items-center py-10 text-center">
      <Icon className="h-10 w-10 text-muted-foreground/40 mb-2" />
      <p className="text-sm text-muted-foreground">{text}</p>
    </CardContent>
  </Card>
);

export default ParentDashboard;
