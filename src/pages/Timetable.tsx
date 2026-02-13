import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Calendar } from "lucide-react";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const TIME_SLOTS = [
  "08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00",
];

const Timetable = () => {
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ class_id: "", day_of_week: "0", start_time: "08:00", end_time: "09:00", room: "" });

  const { data: entries = [] } = useQuery({
    queryKey: ["timetable"],
    queryFn: async () => {
      const { data, error } = await supabase.from("timetable_entries").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: classes = [] } = useQuery({
    queryKey: ["classes"],
    queryFn: async () => {
      const { data } = await supabase.from("classes").select("id, name, teacher_id");
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

  const classMap = Object.fromEntries(classes.map(c => [c.id, c]));
  const profileMap = Object.fromEntries(profiles.map(p => [p.user_id, p.full_name]));

  const createEntry = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("timetable_entries").insert({
        class_id: form.class_id,
        day_of_week: parseInt(form.day_of_week),
        start_time: form.start_time,
        end_time: form.end_time,
        room: form.room,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timetable"] });
      queryClient.invalidateQueries({ queryKey: ["timetable-count"] });
      setForm({ class_id: "", day_of_week: "0", start_time: "08:00", end_time: "09:00", room: "" });
      setOpen(false);
      toast.success("Entry added!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteEntry = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("timetable_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timetable"] });
      queryClient.invalidateQueries({ queryKey: ["timetable-count"] });
      toast.success("Entry removed!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const getEntriesForSlot = (day: number, time: string) =>
    entries.filter(e => e.day_of_week === day && e.start_time <= time && e.end_time > time);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Weekly Timetable</h1>
          <p className="text-muted-foreground mt-1">
            {isAdmin ? "Manage class schedules" : "View your weekly schedule"}
          </p>
        </div>
        {isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" /> Add Entry</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Timetable Entry</DialogTitle></DialogHeader>
              <form onSubmit={e => { e.preventDefault(); createEntry.mutate(); }} className="space-y-4">
                <div className="space-y-2">
                  <Label>Class</Label>
                  <Select value={form.class_id} onValueChange={v => setForm(f => ({ ...f, class_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                    <SelectContent>
                      {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Day</Label>
                  <Select value={form.day_of_week} onValueChange={v => setForm(f => ({ ...f, day_of_week: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DAYS.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Start Time</Label>
                    <Input type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} required />
                  </div>
                  <div className="space-y-2">
                    <Label>End Time</Label>
                    <Input type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Room</Label>
                  <Input value={form.room} onChange={e => setForm(f => ({ ...f, room: e.target.value }))} placeholder="e.g. Room 101" />
                </div>
                <Button type="submit" className="w-full" disabled={createEntry.isPending || !form.class_id}>
                  {createEntry.isPending ? "Adding..." : "Add Entry"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardContent className="p-0 overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="p-3 text-left font-medium text-muted-foreground w-20">Time</th>
                {DAYS.slice(0, 5).map(d => (
                  <th key={d} className="p-3 text-left font-medium text-muted-foreground min-w-[140px]">{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TIME_SLOTS.map(time => (
                <tr key={time} className="border-b last:border-0">
                  <td className="p-3 font-mono text-xs text-muted-foreground">{time}</td>
                  {[0, 1, 2, 3, 4].map(day => {
                    const slotEntries = getEntriesForSlot(day, time);
                    return (
                      <td key={day} className="p-1.5">
                        {slotEntries.map(entry => {
                          const cls = classMap[entry.class_id];
                          return (
                            <div key={entry.id} className="rounded-lg bg-primary/10 text-primary p-2 text-xs space-y-0.5 group relative">
                              <p className="font-semibold">{cls?.name ?? "Unknown"}</p>
                              {cls?.teacher_id && <p className="opacity-70">{profileMap[cls.teacher_id] ?? ""}</p>}
                              {entry.room && <p className="opacity-60">{entry.room}</p>}
                              {isAdmin && (
                                <button
                                  onClick={() => deleteEntry.mutate(entry.id)}
                                  className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-destructive text-xs hover:bg-destructive/10 rounded px-1"
                                >×</button>
                              )}
                            </div>
                          );
                        })}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
};

export default Timetable;
