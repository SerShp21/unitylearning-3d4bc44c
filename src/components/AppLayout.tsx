import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { GraduationCap, LayoutDashboard, BookOpen, Calendar, Users, LogOut, ClipboardList, FileText, Bot } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const NAV_ITEMS = [
  { to: "/", icon: LayoutDashboard, label: "Home", shortLabel: "Home" },
  { to: "/classes", icon: BookOpen, label: "Classes", shortLabel: "Classes" },
  { to: "/timetable", icon: Calendar, label: "Timetable", shortLabel: "Schedule" },
  { to: "/registry", icon: ClipboardList, label: "Registry", shortLabel: "Registry" },
  { to: "/lectures", icon: FileText, label: "Lectures", shortLabel: "Lectures" },
];

const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { signOut, profile, role, isSuperAdmin, isAdmin } = useAuth();
  const isTeacherOrAdmin = isAdmin || role === "teacher";
  const location = useLocation();

  const roleBadgeColor = {
    super_admin: "bg-destructive text-destructive-foreground",
    admin: "bg-primary text-primary-foreground",
    teacher: "bg-accent text-accent-foreground",
    student: "bg-secondary text-secondary-foreground",
  }[role ?? "student"];

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-60 flex-col bg-primary text-primary-foreground p-4 shrink-0">
        <div className="flex items-center gap-2 mb-8">
          <GraduationCap className="h-7 w-7" />
          <span className="text-lg font-bold font-['Space_Grotesk']">UnityClass</span>
        </div>
        <nav className="flex-1 space-y-0.5">
          {NAV_ITEMS.map(item => (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                location.pathname === item.to ? "bg-primary-foreground/20 font-medium" : "hover:bg-primary-foreground/10"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
          {isTeacherOrAdmin && (
            <Link
              to="/robot"
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                location.pathname === "/robot" ? "bg-primary-foreground/20 font-medium" : "hover:bg-primary-foreground/10"
              }`}
            >
              <Bot className="h-4 w-4" />
              Robot
            </Link>
          )}
          {isSuperAdmin && (
            <Link
              to="/users"
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                location.pathname === "/users" ? "bg-primary-foreground/20 font-medium" : "hover:bg-primary-foreground/10"
              }`}
            >
              <Users className="h-4 w-4" />
              Users
            </Link>
          )}
        </nav>
        <div className="border-t border-primary-foreground/20 pt-3 mt-3">
          <div className="flex items-center gap-2 mb-2 px-1">
            <div className="h-8 w-8 rounded-full bg-primary-foreground/20 flex items-center justify-center text-xs font-bold shrink-0">
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

      {/* Mobile: content area + bottom nav */}
      <div className="flex flex-1 flex-col min-h-0">
        {/* Mobile top bar - compact */}
        <header className="md:hidden flex items-center justify-between border-b px-3 py-2 bg-card shrink-0">
          <div className="flex items-center gap-1.5">
            <GraduationCap className="h-5 w-5 text-primary" />
            <span className="font-bold text-sm">UnityClass</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge variant="secondary" className={`text-[9px] px-1.5 py-0 ${roleBadgeColor}`}>
              {role?.replace("_", " ") ?? "student"}
            </Badge>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={signOut}><LogOut className="h-3.5 w-3.5" /></Button>
          </div>
        </header>

        {/* Main content - fills remaining space */}
        <main className="flex-1 p-3 md:p-6 overflow-auto pb-16 md:pb-6">{children}</main>

        {/* Mobile bottom nav - fixed */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t flex items-stretch z-50 safe-area-bottom">
          {NAV_ITEMS.map(item => {
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex-1 flex flex-col items-center justify-center py-1.5 gap-0.5 transition-colors ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <item.icon className={`h-4 w-4 ${active ? "text-primary" : ""}`} />
                <span className="text-[10px] leading-tight font-medium">{item.shortLabel}</span>
              </Link>
            );
          })}
          {isTeacherOrAdmin && (
            <Link
              to="/robot"
              className={`flex-1 flex flex-col items-center justify-center py-1.5 gap-0.5 transition-colors ${
                location.pathname === "/robot" ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Bot className={`h-4 w-4 ${location.pathname === "/robot" ? "text-primary" : ""}`} />
              <span className="text-[10px] leading-tight font-medium">Robot</span>
            </Link>
          )}
          {isSuperAdmin && (
            <Link
              to="/users"
              className={`flex-1 flex flex-col items-center justify-center py-1.5 gap-0.5 transition-colors ${
                location.pathname === "/users" ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Users className={`h-4 w-4 ${location.pathname === "/users" ? "text-primary" : ""}`} />
              <span className="text-[10px] leading-tight font-medium">Users</span>
            </Link>
          )}
        </nav>
      </div>
    </div>
  );
};

export default AppLayout;
