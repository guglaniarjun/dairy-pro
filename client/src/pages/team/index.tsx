import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { allTenantPermissions, permissionCatalog, roleLabels, rolePermissions, tenantRoles, type TenantRole } from "@shared/rbac";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { KeyRound, Loader2, Plus, ShieldCheck, SlidersHorizontal, UserCog, Users } from "lucide-react";

type TeamMember = {
  id: string; userId: string; email: string; firstName: string | null; lastName: string | null;
  role: string; permissions: string[]; effectivePermissions: string[]; isActive: boolean; isOwner?: boolean;
};

type TeamData = {
  owner: TeamMember | null;
  members: TeamMember[];
  usage: { current: number; limit: number; plan: string };
};

const roleDescriptions: Record<string, string> = {
  admin: "Full farm control, including team, billing, and settings",
  manager: "Runs daily farm operations and reports",
  accountant: "Finances, sales, inventory visibility, and reports",
  supervisor: "Coordinates cattle, staff tasks, feed, and inventory",
  veterinarian: "Cattle health, breeding, treatments, and reports",
  worker: "Daily milk, feed, task, and basic herd operations",
  viewer: "Read-only operational access",
};

function displayName(member: TeamMember) {
  return [member.firstName, member.lastName].filter(Boolean).join(" ") || member.email;
}

function AddUserDialog({ disabled }: { disabled: boolean }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", password: "", role: "worker" as TenantRole });
  const create = useMutation({
    mutationFn: () => apiRequest("POST", "/api/team", form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team"] });
      setOpen(false);
      setForm({ firstName: "", lastName: "", email: "", password: "", role: "worker" });
      toast({ title: "User added", description: "The new user can now sign in with the supplied credentials." });
    },
    onError: (error: Error) => toast({ title: "Could not add user", description: error.message, variant: "destructive" }),
  });
  const valid = form.firstName.trim() && form.email.includes("@") && form.password.length >= 8;

  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button disabled={disabled}><Plus className="w-4 h-4 mr-2" />Add user</Button></DialogTrigger>
    <DialogContent className="sm:max-w-lg">
      <DialogHeader><DialogTitle>Add farm user</DialogTitle><DialogDescription>Create credentials and assign the user's starting role.</DialogDescription></DialogHeader>
      <div className="grid grid-cols-2 gap-4 py-2">
        <div><Label>First name *</Label><Input value={form.firstName} onChange={event => setForm(current => ({ ...current, firstName: event.target.value }))} /></div>
        <div><Label>Last name</Label><Input value={form.lastName} onChange={event => setForm(current => ({ ...current, lastName: event.target.value }))} /></div>
        <div className="col-span-2"><Label>Email *</Label><Input type="email" autoComplete="off" value={form.email} onChange={event => setForm(current => ({ ...current, email: event.target.value }))} /></div>
        <div className="col-span-2"><Label>Temporary password *</Label><Input type="password" autoComplete="new-password" value={form.password} onChange={event => setForm(current => ({ ...current, password: event.target.value }))} /><p className="text-xs text-muted-foreground mt-1">At least 8 characters. Share it securely with the user.</p></div>
        <div className="col-span-2"><Label>Role</Label><Select value={form.role} onValueChange={(role: TenantRole) => setForm(current => ({ ...current, role }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{tenantRoles.map(role => <SelectItem key={role} value={role}><div><span>{roleLabels[role]}</span><span className="text-xs text-muted-foreground ml-2">— {roleDescriptions[role]}</span></div></SelectItem>)}</SelectContent></Select></div>
      </div>
      <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={!valid || create.isPending} onClick={() => create.mutate()}>{create.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Create user</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}

function PermissionsDialog({ member }: { member: TeamMember }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(member.permissions.length ? member.permissions : member.effectivePermissions);
  useEffect(() => setSelected(member.permissions.length ? member.permissions : member.effectivePermissions), [member]);
  const save = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/team/${member.id}`, { permissions: selected }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/team"] }); setOpen(false); toast({ title: "Permissions saved" }); },
    onError: (error: Error) => toast({ title: "Could not save permissions", description: error.message, variant: "destructive" }),
  });
  const grouped = useMemo(() => permissionCatalog.reduce<Record<string, typeof permissionCatalog[number][]>>((result, permission) => {
    (result[permission.group] ||= []).push(permission); return result;
  }, {}), []);
  const toggle = (permission: string, checked: boolean) => setSelected(current => checked ? Array.from(new Set([...current, permission])) : current.filter(item => item !== permission));

  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button size="sm" variant="ghost"><SlidersHorizontal className="w-4 h-4 mr-1.5" />Permissions</Button></DialogTrigger>
    <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Permissions for {displayName(member)}</DialogTitle><DialogDescription>These selections override the normal {roleLabels[member.role as TenantRole]} role preset.</DialogDescription></DialogHeader>
      <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setSelected(rolePermissions[member.role as TenantRole] || [])}>Use role preset</Button><Button size="sm" variant="outline" onClick={() => setSelected(allTenantPermissions)}>Select all</Button></div>
      <div className="grid sm:grid-cols-2 gap-4 py-2">{Object.entries(grouped).map(([group, permissions]) => <div key={group} className="rounded-lg border p-3"><p className="font-semibold text-sm mb-2">{group}</p><div className="space-y-2">{permissions.map(permission => <label key={permission.key} className="flex items-center gap-2 text-sm cursor-pointer"><Checkbox checked={selected.includes(permission.key)} onCheckedChange={checked => toggle(permission.key, checked === true)} /><span>{permission.label}</span></label>)}</div></div>)}</div>
      <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={save.isPending} onClick={() => save.mutate()}>Save permissions</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}

function PasswordDialog({ member }: { member: TeamMember }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const reset = useMutation({
    mutationFn: () => apiRequest("POST", `/api/team/${member.id}/reset-password`, { password }),
    onSuccess: () => { setOpen(false); setPassword(""); toast({ title: "Password reset", description: "The new password is active immediately." }); },
    onError: (error: Error) => toast({ title: "Could not reset password", description: error.message, variant: "destructive" }),
  });
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button size="sm" variant="ghost"><KeyRound className="w-4 h-4 mr-1.5" />Password</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Reset password</DialogTitle><DialogDescription>Set a new password for {displayName(member)}.</DialogDescription></DialogHeader><div><Label>New password</Label><Input type="password" autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} /><p className="text-xs text-muted-foreground mt-1">Minimum 8 characters.</p></div><DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={password.length < 8 || reset.isPending} onClick={() => reset.mutate()}>Reset password</Button></DialogFooter></DialogContent></Dialog>;
}

export default function TeamPage() {
  const { toast } = useToast();
  const { data, isLoading, isError } = useQuery<TeamData>({ queryKey: ["/api/team"] });
  const update = useMutation({
    mutationFn: ({ id, values }: { id: string; values: Record<string, unknown> }) => apiRequest("PATCH", `/api/team/${id}`, values),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/team"] }); toast({ title: "User updated" }); },
    onError: (error: Error) => toast({ title: "Could not update user", description: error.message, variant: "destructive" }),
  });
  const members = data ? [data.owner, ...data.members].filter(Boolean) as TeamMember[] : [];
  const atLimit = !!data && data.usage.current >= data.usage.limit;

  return <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3"><div><div className="flex items-center gap-2"><Users className="w-7 h-7 text-primary" /><h1 className="text-2xl font-bold">Users & Roles</h1></div><p className="text-sm text-muted-foreground mt-1">Create farm users and control exactly what each person can access.</p></div><AddUserDialog disabled={atLimit || isLoading} /></div>

    {data && <Card><CardContent className="p-4"><div className="flex items-center justify-between text-sm mb-2"><span className="font-medium">{data.usage.plan} plan usage</span><span>{data.usage.current} of {data.usage.limit} users</span></div><Progress value={Math.min(100, data.usage.current / data.usage.limit * 100)} /><p className="text-xs text-muted-foreground mt-2">The farm owner counts as one user. User limits follow the assigned subscription plan.</p></CardContent></Card>}

    <Card>
      <CardHeader><CardTitle className="text-lg">Farm team</CardTitle><CardDescription>Deactivated users cannot access this farm. Owners cannot be edited from this page.</CardDescription></CardHeader>
      <CardContent className="p-0">
        <Table><TableHeader><TableRow><TableHead>User</TableHead><TableHead>Role</TableHead><TableHead>Access</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Security</TableHead></TableRow></TableHeader><TableBody>
          {isLoading && <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground"><Loader2 className="w-5 h-5 inline mr-2 animate-spin" />Loading users…</TableCell></TableRow>}
          {isError && <TableRow><TableCell colSpan={5} className="text-center py-12 text-destructive">You do not have permission to manage this farm's users.</TableCell></TableRow>}
          {members.map(member => <TableRow key={member.id}>
            <TableCell><div className="flex items-center gap-3"><div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center"><UserCog className="w-4 h-4" /></div><div><p className="font-medium">{displayName(member)}</p><p className="text-xs text-muted-foreground">{member.email}</p></div></div></TableCell>
            <TableCell>{member.isOwner ? <Badge className="gap-1"><ShieldCheck className="w-3 h-3" />Owner</Badge> : <Select value={member.role} onValueChange={role => update.mutate({ id: member.id, values: { role, permissions: [] } })}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent>{tenantRoles.map(role => <SelectItem key={role} value={role}>{roleLabels[role]}</SelectItem>)}</SelectContent></Select>}</TableCell>
            <TableCell><p className="text-sm">{member.effectivePermissions.length} permissions</p><p className="text-xs text-muted-foreground max-w-56 truncate">{member.isOwner ? "Complete farm control" : roleDescriptions[member.role]}</p></TableCell>
            <TableCell>{member.isOwner ? <Badge variant="outline">Active</Badge> : <div className="flex items-center gap-2"><Switch checked={member.isActive} onCheckedChange={isActive => update.mutate({ id: member.id, values: { isActive } })} /><span className="text-sm">{member.isActive ? "Active" : "Disabled"}</span></div>}</TableCell>
            <TableCell className="text-right">{!member.isOwner && <div className="flex justify-end"><PermissionsDialog member={member} /><PasswordDialog member={member} /></div>}</TableCell>
          </TableRow>)}
        </TableBody></Table>
      </CardContent>
    </Card>
  </div>;
}
