import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Users, Calendar, GraduationCap } from "lucide-react";
import { Link } from "react-router-dom";

const Dashboard = () => {
  const { user, role, profile, isAdmin, isSuperAdmin } = useAuth();

  const { data: classCount = 0 } = useQuery({
    queryKey: ["class-count"],
    queryFn: async () => {
      const { count } = await supabase.from("classes").select("*", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  const { data: timetableCount = 0 } = useQuery({
    queryKey: ["timetable-count"],
    queryFn: async () => {
      const { count } = await supabase.from("timetable_entries").select("*", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  const { data: userCount = 0 } = useQuery({
    queryKey: ["user-count"],
    enabled: isSuperAdmin,
    queryFn: async () => {
      const { count } = await supabase.from("profiles").select("*", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  const stats = [
    { label: "Classes", value: classCount, icon: BookOpen, to: "/classes", color: "text-primary" },
    { label: "Timetable Entries", value: timetableCount, icon: Calendar, to: "/timetable", color: "text-accent" },
    ...(isSuperAdmin ? [{ label: "Users", value: userCount, icon: Users, to: "/users", color: "text-destructive" }] : []),
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Welcome, {profile?.full_name || "User"}</h1>
        <p className="text-muted-foreground mt-1">
          {isAdmin ? "Manage your classes, timetable, and users." : role === "teacher" ? "View your assigned classes and schedule." : "View your enrolled classes and schedule."}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map(s => (
          <Link key={s.label} to={s.to}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
                <s.icon className={`h-5 w-5 ${s.color}`} />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{s.value}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {!isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><GraduationCap className="h-5 w-5" /> Quick Info</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground">
            {role === "teacher"
              ? "Navigate to Classes to see your assigned classes, or Timetable for your weekly schedule."
              : "Navigate to Classes to see your enrolled classes, or Timetable for your weekly schedule."}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Dashboard;
