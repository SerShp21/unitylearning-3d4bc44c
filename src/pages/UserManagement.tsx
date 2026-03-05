import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Search, Shield, UserX, Plus, ScanFace, Trash2, CheckCircle2, Pencil, Mail } from "lucide-react";
import type { Enums } from "@/integrations/supabase/types";
import { FaceCapture } from "@/components/FaceCapture";

type AppRole = Enums<"app_role">;
const ROLES: AppRole[] = ["super_admin", "admin", "teacher", "student", "parent"];

const UserManagement = () => {
  const { isSuperAdmin, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [expelTarget, setExpelTarget] = useState<{ user_id: string; full_name: string } | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [editFaceTarget, setEditFaceTarget] = useState<{ user_id: string; full_name: string } | null>(null);
  const [editFaceDescriptor, setEditFaceDescriptor] = useState<number[] | null>(null);
  const [editProfileTarget, setEditProfileTarget] = useState<any>(null);
  const [editForm, setEditForm] = useState({ full_name: "", gender: "", parent_email: "", parent_phone: "" });

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
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["all-users"] }); toast.success("Role updated!"); },
    onError: (err: any) => toast.error(err.message),
  });

  const expelStudent = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.from("class_enrollments").delete().eq("student_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enrollments", "all-users"] });
      setExpelTarget(null);
      toast.success("Student expelled from all classes!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const inviteUser = useMutation({
    mutationFn: async () => {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/externalapi?resource=invite_user`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({ email: inviteEmail }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to invite user");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-users"] });
      setInviteEmail("");
      setCreateOpen(false);
      toast.success("Invitation sent! The student will receive an email to set up their account.");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const saveFaceId = useMutation({
    mutationFn: async ({ userId, descriptor }: { userId: string; descriptor: number[] | null }) => {
      const { error } = await supabase.from("profiles").update({ face_id: descriptor ? JSON.stringify(descriptor) : null }).eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-users"] });
      setEditFaceTarget(null);
      setEditFaceDescriptor(null);
      toast.success("Face ID updated!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateProfile = useMutation({
    mutationFn: async (userId: string) => {
      const updates: any = {};
      if (editForm.full_name) updates.full_name = editForm.full_name;
      if (editForm.gender) updates.gender = editForm.gender;
      if (editForm.parent_email) updates.parent_email = editForm.parent_email;
      if (editForm.parent_phone) updates.parent_phone = editForm.parent_phone;
      const { error } = await supabase.from("profiles").update(updates).eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-users"] });
      setEditProfileTarget(null);
      toast.success("Profile updated!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteUser = useMutation({
    mutationFn: async (userId: string) => {
      await supabase.from("class_enrollments").delete().eq("student_id", userId);
      await supabase.from("attendance").delete().eq("student_id", userId);
      await supabase.from("grades").delete().eq("student_id", userId);
      const { error: roleErr } = await supabase.from("user_roles").delete().eq("user_id", userId);
      if (roleErr) throw roleErr;
      const { error: profErr } = await supabase.from("profiles").delete().eq("user_id", userId);
      if (profErr) throw profErr;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["all-users"] }); toast.success("User removed!"); },
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
      parent: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
    };
    return colors[role];
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">User Management</h1>
          <p className="text-muted-foreground mt-1">Invite users and manage profiles</p>
        </div>
        {isSuperAdmin && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" /> Invite User</Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader><DialogTitle>Invite New User</DialogTitle></DialogHeader>
              <form onSubmit={e => { e.preventDefault(); inviteUser.mutate(); }} className="space-y-4">
                <div className="space-y-2">
                  <Label>Student Email</Label>
                  <Input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="student@example.com" required />
                  <p className="text-xs text-muted-foreground">The student will receive an email with a link to complete their account setup.</p>
                </div>
                <Button type="submit" className="w-full" disabled={inviteUser.isPending}>
                  <Mail className="h-4 w-4 mr-2" />
                  {inviteUser.isPending ? "Sending..." : "Send Invitation"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by name or role..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
      </div>

      {/* Expel confirmation dialog */}
      <Dialog open={!!expelTarget} onOpenChange={v => !v && setExpelTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Expel Student</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Are you sure you want to expel <strong>{expelTarget?.full_name}</strong> from all classes?</p>
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" onClick={() => setExpelTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => expelTarget && expelStudent.mutate(expelTarget.user_id)} disabled={expelStudent.isPending}>
              {expelStudent.isPending ? "Expelling..." : "Expel"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Face ID dialog */}
      <Dialog open={!!editFaceTarget} onOpenChange={v => { if (!v) { setEditFaceTarget(null); setEditFaceDescriptor(null); }}}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Face ID — {editFaceTarget?.full_name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {!editFaceDescriptor ? (
              <FaceCapture label="Capture New Face" onCapture={desc => setEditFaceDescriptor(desc)} />
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-3">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-sm">New face descriptor captured</span>
                  <Button type="button" variant="ghost" size="sm" className="ml-auto" onClick={() => setEditFaceDescriptor(null)}>Retake</Button>
                </div>
                <Button className="w-full" onClick={() => editFaceTarget && saveFaceId.mutate({ userId: editFaceTarget.user_id, descriptor: editFaceDescriptor })} disabled={saveFaceId.isPending}>
                  {saveFaceId.isPending ? "Saving..." : "Save Face ID"}
                </Button>
              </div>
            )}
            {editFaceTarget && (
              <Button variant="outline" className="w-full" onClick={() => saveFaceId.mutate({ userId: editFaceTarget.user_id, descriptor: null })} disabled={saveFaceId.isPending}>Remove Face ID</Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Profile dialog (super admin) */}
      <Dialog open={!!editProfileTarget} onOpenChange={v => !v && setEditProfileTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Profile — {editProfileTarget?.full_name || "User"}</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); updateProfile.mutate(editProfileTarget.user_id); }} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Full Name</Label>
              <Input value={editForm.full_name} onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Gender</Label>
              <Select value={editForm.gender} onValueChange={v => setEditForm(f => ({ ...f, gender: v }))}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Parent Email</Label>
              <Input type="email" value={editForm.parent_email} onChange={e => setEditForm(f => ({ ...f, parent_email: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Parent Phone</Label>
              <Input type="tel" value={editForm.parent_phone} onChange={e => setEditForm(f => ({ ...f, parent_phone: e.target.value }))} placeholder="+1234567890" />
            </div>
            <Button type="submit" className="w-full" disabled={updateProfile.isPending}>{updateProfile.isPending ? "Saving..." : "Save Changes"}</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {filtered.map(user => {
              const hasFace = !!(user as any).face_id;
              const setupDone = !!(user as any).setup_completed;
              return (
                <div key={user.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3">
                    {/* Face avatar or initial */}
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary overflow-hidden">
                      {hasFace ? (
                        <ScanFace className="h-5 w-5 text-primary" />
                      ) : (
                        user.full_name?.charAt(0)?.toUpperCase() || "U"
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{user.full_name || "Unnamed"}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Badge variant="outline" className={`text-[10px] ${roleBadge(user.role)}`}>
                          {user.role.replace("_", " ")}
                        </Badge>
                        {hasFace && (
                          <Badge variant="outline" className="text-[10px] bg-accent/10 text-accent border-accent/20">
                            <ScanFace className="h-2.5 w-2.5 mr-0.5" /> Face ID
                          </Badge>
                        )}
                        {!setupDone && (
                          <Badge variant="outline" className="text-[10px] bg-warning/10 text-warning border-warning/20">
                            Pending setup
                          </Badge>
                        )}
                        {(user as any).gender && (
                          <Badge variant="outline" className="text-[10px]">{(user as any).gender}</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {isSuperAdmin && (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => {
                          setEditProfileTarget(user);
                          setEditForm({ full_name: user.full_name || "", gender: (user as any).gender || "", parent_email: (user as any).parent_email || "", parent_phone: (user as any).parent_phone || "" });
                        }}>
                          <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => { setEditFaceTarget({ user_id: user.user_id, full_name: user.full_name }); setEditFaceDescriptor(null); }}>
                          <ScanFace className="h-3.5 w-3.5 mr-1" /> Face
                        </Button>
                      </>
                    )}
                    {user.role === "student" && isAdmin && (
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive"
                        onClick={() => setExpelTarget({ user_id: user.user_id, full_name: user.full_name })}>
                        <UserX className="h-3.5 w-3.5 mr-1" /> Expel
                      </Button>
                    )}
                    {isSuperAdmin && (
                      <>
                        <Select value={user.role} onValueChange={(v: AppRole) => updateRole.mutate({ userId: user.user_id, roleId: user.role_id, newRole: v })}>
                          <SelectTrigger className="w-36">
                            <Shield className="h-3.5 w-3.5 mr-1.5" /><SelectValue />
                          </SelectTrigger>
                          <SelectContent>{ROLES.map(r => <SelectItem key={r} value={r}>{r.replace("_", " ")}</SelectItem>)}</SelectContent>
                        </Select>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive h-8 w-8"
                          onClick={() => { if (confirm(`Delete user "${user.full_name}"?`)) deleteUser.mutate(user.user_id); }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
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
