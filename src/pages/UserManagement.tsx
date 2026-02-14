import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Search, Shield, UserX } from "lucide-react";
import type { Enums } from "@/integrations/supabase/types";

type AppRole = Enums<"app_role">;
const ROLES: AppRole[] = ["super_admin", "admin", "teacher", "student"];

const UserManagement = () => {
  const { isSuperAdmin, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [expelTarget, setExpelTarget] = useState<{ user_id: string; full_name: string } | null>(null);

  const { data: users = [] } = useQuery({
    queryKey: ["all-users"],
    queryFn: async () => {
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*"),
        supabase.from("user_roles").select("*"),
      ]);
      return (profiles ?? []).map(p => ({
        ...p,
        role: roles?.find(r => r.user_id === p.user_id)?.role as AppRole ?? "student",
        role_id: roles?.find(r => r.user_id === p.user_id)?.id,
      }));
    },
  });

  const updateRole = useMutation({
    mutationFn: async ({ userId, roleId, newRole }: { userId: string; roleId?: string; newRole: AppRole }) => {
      if (roleId) {
        const { error } = await supabase.from("user_roles").update({ role: newRole }).eq("id", roleId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: newRole });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-users"] });
      toast.success("Role updated!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const expelStudent = useMutation({
    mutationFn: async (userId: string) => {
      // Remove from all class enrollments
      const { error } = await supabase.from("class_enrollments").delete().eq("student_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enrollments"] });
      queryClient.invalidateQueries({ queryKey: ["all-users"] });
      setExpelTarget(null);
      toast.success("Student expelled from all classes!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const filtered = users.filter(u =>
    u.full_name.toLowerCase().includes(search.toLowerCase()) ||
    u.role.includes(search.toLowerCase())
  );

  if (!isSuperAdmin && !isAdmin) {
    return <div className="text-center py-12 text-muted-foreground">Access denied. Admin only.</div>;
  }

  const roleBadge = (role: AppRole) => {
    const colors: Record<AppRole, string> = {
      super_admin: "bg-destructive/10 text-destructive border-destructive/20",
      admin: "bg-primary/10 text-primary border-primary/20",
      teacher: "bg-accent/10 text-accent border-accent/20",
      student: "bg-secondary text-secondary-foreground",
    };
    return colors[role];
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">User Management</h1>
        <p className="text-muted-foreground mt-1">View all users, change roles, and expel students</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by name or role..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
      </div>

      {/* Expel confirmation dialog */}
      <Dialog open={!!expelTarget} onOpenChange={v => !v && setExpelTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Expel Student</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to expel <strong>{expelTarget?.full_name}</strong> from all classes? This will remove all their enrollments.
          </p>
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" onClick={() => setExpelTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => expelTarget && expelStudent.mutate(expelTarget.user_id)}
              disabled={expelStudent.isPending}>
              {expelStudent.isPending ? "Expelling..." : "Expel"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {filtered.map(user => (
              <div key={user.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                    {user.full_name?.charAt(0)?.toUpperCase() || "U"}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{user.full_name || "Unnamed"}</p>
                    <Badge variant="outline" className={`text-[10px] mt-0.5 ${roleBadge(user.role)}`}>
                      {user.role.replace("_", " ")}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {user.role === "student" && (
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive"
                      onClick={() => setExpelTarget({ user_id: user.user_id, full_name: user.full_name })}>
                      <UserX className="h-3.5 w-3.5 mr-1" /> Expel
                    </Button>
                  )}
                  {isSuperAdmin && (
                    <Select
                      value={user.role}
                      onValueChange={(v: AppRole) => updateRole.mutate({ userId: user.user_id, roleId: user.role_id, newRole: v })}
                    >
                      <SelectTrigger className="w-40">
                        <Shield className="h-3.5 w-3.5 mr-1.5" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map(r => (
                          <SelectItem key={r} value={r}>{r.replace("_", " ")}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">No users found</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default UserManagement;
