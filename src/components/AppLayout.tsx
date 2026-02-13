import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { GraduationCap, LayoutDashboard, BookOpen, Calendar, Users, LogOut, ClipboardList, Award } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const NAV_ITEMS = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/classes", icon: BookOpen, label: "Classes" },
  { to: "/timetable", icon: Calendar, label: "Timetable" },
  { to: "/grades", icon: Award, label: "Grades" },
  { to: "/attendance", icon: ClipboardList, label: "Attendance" },
];

const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { signOut, profile, role, isSuperAdmin } = useAuth();
  const location = useLocation();

  const roleBadgeColor = {
    super_admin: "bg-destructive text-destructive-foreground",
    admin: "bg-primary text-primary-foreground",
    teacher: "bg-accent text-accent-foreground",
    student: "bg-secondary text-secondary-foreground",
  }[role ?? "student"];

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 flex-col bg-primary text-primary-foreground p-4">
        <div className="flex items-center gap-2 mb-8">
          <GraduationCap className="h-8 w-8" />
          <span className="text-xl font-bold font-['Space_Grotesk']">UnityClass</span>
        </div>
        <nav className="flex-1 space-y-1">
          {NAV_ITEMS.map(item => (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                location.pathname === item.to ? "bg-primary-foreground/20 font-medium" : "hover:bg-primary-foreground/10"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
          {isSuperAdmin && (
            <Link
              to="/users"
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                location.pathname === "/users" ? "bg-primary-foreground/20 font-medium" : "hover:bg-primary-foreground/10"
              }`}
            >
              <Users className="h-4 w-4" />
              User Management
            </Link>
          )}
        </nav>
        <div className="border-t border-primary-foreground/20 pt-4 mt-4">
          <div className="flex items-center gap-2 mb-3 px-1">
            <div className="h-8 w-8 rounded-full bg-primary-foreground/20 flex items-center justify-center text-xs font-bold">
              {profile?.full_name?.charAt(0)?.toUpperCase() || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm truncate font-medium">{profile?.full_name || "User"}</p>
              <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${roleBadgeColor}`}>
                {role?.replace("_", " ") ?? "student"}
              </Badge>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10" onClick={signOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="flex flex-1 flex-col">
        <header className="md:hidden flex items-center justify-between border-b p-3 bg-card">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-6 w-6 text-primary" />
            <span className="font-bold">UnityClass</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className={`text-[10px] ${roleBadgeColor}`}>
              {role?.replace("_", " ") ?? "student"}
            </Badge>
            <Button variant="ghost" size="icon" onClick={signOut}><LogOut className="h-4 w-4" /></Button>
          </div>
        </header>
        {/* Mobile nav */}
        <nav className="md:hidden flex border-b bg-card overflow-x-auto">
          {NAV_ITEMS.map(item => (
            <Link key={item.to} to={item.to} className={`flex items-center gap-1.5 px-4 py-2.5 text-xs whitespace-nowrap border-b-2 ${location.pathname === item.to ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>
              <item.icon className="h-3.5 w-3.5" />{item.label}
            </Link>
          ))}
          {isSuperAdmin && (
            <Link to="/users" className={`flex items-center gap-1.5 px-4 py-2.5 text-xs whitespace-nowrap border-b-2 ${location.pathname === "/users" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>
              <Users className="h-3.5 w-3.5" />Users
            </Link>
          )}
        </nav>
        <main className="flex-1 p-4 md:p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
};

export default AppLayout;
