import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { BookOpen, Users, Calendar, GraduationCap, Award, ClipboardList } from "lucide-react";
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
    { label: "Classes", value: classCount, icon: BookOpen, to: "/classes", color: "text-primary bg-primary/10" },
    { label: "Schedule", value: timetableCount, icon: Calendar, to: "/timetable", color: "text-accent bg-accent/10" },
    { label: "Grades", value: "—", icon: Award, to: "/grades", color: "text-warning bg-warning/10" },
    { label: "Attendance", value: "—", icon: ClipboardList, to: "/attendance", color: "text-success bg-success/10" },
    ...(isSuperAdmin ? [{ label: "Users", value: userCount, icon: Users, to: "/users", color: "text-destructive bg-destructive/10" }] : []),
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Hi, {profile?.full_name?.split(" ")[0] || "there"} 👋</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {isAdmin ? "Manage your school at a glance." : role === "teacher" ? "Your teaching overview." : "Your student dashboard."}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3">
        {stats.map(s => (
          <Link key={s.label} to={s.to}>
            <Card className="hover:shadow-md transition-all cursor-pointer h-full">
              <CardContent className="p-3 sm:p-4 flex items-center gap-3">
                <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${s.color}`}>
                  <s.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-lg sm:text-xl font-bold leading-tight">{s.value}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
