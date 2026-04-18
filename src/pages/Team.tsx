import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, N8N_BASE_URL } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { TeamMember, Role, CleanerType } from '@/types';
import { logActivity } from '@/lib/activityLog';
import { toast } from 'sonner';
import { Loader2, Plus, Pencil, Trash2, Users, KeyRound, BarChart3, Search, X } from 'lucide-react';
import MemberStatsDialog from '@/components/team/MemberStatsDialog';
import CleanerPerformance from '@/components/dashboard/CleanerPerformance';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';

const ROLE_BADGE: Record<Role, string> = {
  owner: 'bg-purple-100 text-purple-800',
  admin: 'bg-indigo-100 text-indigo-800',
  manager: 'bg-blue-100 text-blue-800',
  agent: 'bg-gray-100 text-gray-800',
  cleaner: 'bg-teal-100 text-teal-800',
  client: 'bg-amber-100 text-amber-800',
};

interface MemberForm {
  name: string;
  email: string;
  phone: string;
  role: Role;
  cleaner_type: CleanerType | '';
  lead_id: string | null;
}

const emptyForm: MemberForm = { name: '', email: '', phone: '', role: 'agent', cleaner_type: '', lead_id: null };

const CLEANER_TYPES: CleanerType[] = ['residential', 'commercial', 'specialist', 'general'];

/** Which roles can the current user create/edit? */
function getAllowedRoles(currentRole: Role | null): Role[] {
  if (currentRole === 'owner') return ['owner', 'admin', 'manager', 'agent', 'cleaner', 'client'];
  if (currentRole === 'admin') return ['manager', 'agent', 'cleaner', 'client'];
  return [];
}

/** Can the current user see/manage a given member row? */
function canManageRow(currentRole: Role | null, targetRole: Role): boolean {
  if (currentRole === 'owner') return true;
  if (currentRole === 'admin') return targetRole === 'manager' || targetRole === 'agent' || targetRole === 'cleaner' || targetRole === 'client';
  return false;
}

/** Can the current user delete a given member? */
function canDeleteRow(currentRole: Role | null, targetRole: Role, targetId: string, selfId: string | undefined): boolean {
  if (targetId === selfId) return false; // can't delete yourself
  return canManageRow(currentRole, targetRole);
}

export default function Team() {
  const { role: currentRole, teamMember: currentMember } = useAuth();
  const canWrite = currentRole === 'owner' || currentRole === 'admin';
  const queryClient = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<MemberForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [statsTarget, setStatsTarget] = useState<TeamMember | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<TeamMember | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [passwordTarget, setPasswordTarget] = useState<TeamMember | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);

  // Fetch team members
  const { data: allMembers = [], isLoading } = useQuery({
    queryKey: ['team-members'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_members')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as TeamMember[];
    },
  });

  // Filter visible members based on role hierarchy
  const members = allMembers.filter((m) => {
    if (currentRole === 'owner' || currentRole === 'manager') return true;
    if (currentRole === 'admin') return m.role === 'manager' || m.role === 'agent' || m.role === 'cleaner' || m.role === 'client';
    return false;
  });

  // Fetch lead counts per member
  const { data: leadCounts = {} } = useQuery({
    queryKey: ['team-lead-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('assigned_to')
        .eq('is_archived', false);
      if (error) throw error;
      const counts: Record<string, number> = {};
      data?.forEach((l) => {
        if (l.assigned_to) {
          counts[l.assigned_to] = (counts[l.assigned_to] || 0) + 1;
        }
      });
      return counts;
    },
  });

  // Toggle active
  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('team_members')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['team-members'] }),
    onError: () => toast.error('Failed to update status'),
  });

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (m: TeamMember) => {
    setEditingId(m.id);
    setForm({ name: m.name, email: m.email, phone: m.phone || '', role: m.role, cleaner_type: (m.cleaner_type as CleanerType) || '', lead_id: m.lead_id ?? null });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.email.trim()) {
      toast.error('Name and email are required');
      return;
    }
    if (!editingId && form.role === 'client' && !form.lead_id) {
      toast.error('Please select a lead for this client account');
      return;
    }
    setSubmitting(true);
    try {
      const cleaner_type = form.role === 'cleaner' ? (form.cleaner_type || null) : null;
      if (editingId) {
        const { error } = await supabase
          .from('team_members')
          .update({ name: form.name, email: form.email, phone: form.phone || null, role: form.role, cleaner_type })
          .eq('id', editingId);
        if (error) throw error;
        toast.success('Member updated');
      } else {
        console.log('Calling n8n:', `${N8N_BASE_URL}/create-team-member`);
        const res = await fetch(`${N8N_BASE_URL}/create-team-member`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.name,
            email: form.email,
            phone: form.phone || null,
            role: form.role,
            cleaner_type,
            password: 'Welcome123!',
            lead_id: form.role === 'client' ? form.lead_id : null,
          }),
        });
        const data = await res.json();
        if (!res.ok || data.success === false) {
          throw new Error(data.error || 'Failed to create member');
        }
        toast.success('Member added');
        await logActivity({
          event_type: 'team_member_created',
          actor_id: currentMember?.id,
          actor_name: currentMember?.name,
          entity_type: 'team_member',
          description: `Added ${form.name} (${form.role})`,
        });
      }
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      queryClient.invalidateQueries({ queryKey: ['cleaner-performance'] });
      setModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      console.log('Calling n8n:', `${N8N_BASE_URL}/delete-team-member`);
      const res = await fetch(`${N8N_BASE_URL}/delete-team-member`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: deleteTarget.user_id, team_member_id: deleteTarget.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete member');
      toast.success(`${deleteTarget.name} has been removed`);
      await logActivity({
        event_type: 'team_member_deleted',
        actor_id: currentMember?.id,
        actor_name: currentMember?.name,
        entity_type: 'team_member',
        entity_id: deleteTarget.id,
        description: `Removed ${deleteTarget.name}`,
      });
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete member');
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleChangePassword = async () => {
    if (!passwordTarget) return;
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setChangingPassword(true);
    try {
      console.log('Calling n8n:', `${N8N_BASE_URL}/update-team-member-password`);
      const res = await fetch(`${N8N_BASE_URL}/update-team-member-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: passwordTarget.user_id, new_password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update password');
      toast.success('Password updated successfully');
      setPasswordTarget(null);
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update password');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleResetPassword = async () => {
    if (!editingId) return;
    const member = allMembers.find((m) => m.id === editingId);
    if (!member) return;
    setResettingPassword(true);
    try {
      console.log('Calling n8n:', `${N8N_BASE_URL}/update-team-member-password`);
      const res = await fetch(`${N8N_BASE_URL}/update-team-member-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: member.user_id, new_password: 'Welcome123!' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reset password');
      toast.success('Password reset to Welcome123!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to reset password');
    } finally {
      setResettingPassword(false);
    }
  };

  // Chart data
  const chartData = members.map((m) => ({
    name: m.name.split(' ')[0],
    leads: leadCounts[m.id] || 0,
  }));

  const allowedRoles = getAllowedRoles(currentRole);
  const colCount = canWrite ? 10 : 6;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Team</h1>
        </div>
        {canWrite && (
          <Button onClick={openAdd} size="sm" className="sm:size-default">
            <Plus className="h-4 w-4" /> Add New Member
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="hidden md:table-cell">Email</TableHead>
              <TableHead className="hidden lg:table-cell">Phone</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="hidden sm:table-cell">Active</TableHead>
              <TableHead className="hidden md:table-cell text-right">Leads</TableHead>
              {canWrite && <TableHead />}
              {canWrite && <TableHead />}
              {canWrite && <TableHead />}
              {canWrite && <TableHead />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((m) => {
              const manageable = canManageRow(currentRole, m.role);
              const deletable = canDeleteRow(currentRole, m.role, m.id, currentMember?.id);

              return (
                <TableRow key={m.id}>
                  <TableCell className="font-medium max-w-[180px]">
                    {m.role === 'client' && m.lead_id ? (
                      <Link to={`/leads/${m.lead_id}`} className="text-primary hover:underline truncate block">
                        {m.name}
                      </Link>
                    ) : (
                      <div className="truncate">{m.name}</div>
                    )}
                    <div className="md:hidden text-xs text-muted-foreground truncate">{m.email}</div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell max-w-[200px] truncate">{m.email}</TableCell>
                  <TableCell className="hidden lg:table-cell">{m.phone || '—'}</TableCell>
                  <TableCell>
                    <Badge className={ROLE_BADGE[m.role]}>{m.role}</Badge>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {canWrite && manageable ? (
                      <Switch
                        checked={m.is_active}
                        onCheckedChange={(checked) =>
                          toggleActive.mutate({ id: m.id, is_active: checked })
                        }
                      />
                    ) : (
                      <Badge variant={m.is_active ? 'default' : 'secondary'}>
                        {m.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-right">{leadCounts[m.id] || 0}</TableCell>
                  {canWrite && (
                    <TableCell>
                      {m.role !== 'client' && (
                        <Button variant="ghost" size="icon" onClick={() => setStatsTarget(m)} title="View Stats">
                          <BarChart3 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  )}
                  {canWrite && (
                    <TableCell>
                      {manageable && (
                        m.role === 'client' && m.lead_id ? (
                          <Button variant="ghost" size="icon" asChild title="Open lead">
                            <Link to={`/leads/${m.lead_id}`}>
                              <Pencil className="h-4 w-4" />
                            </Link>
                          </Button>
                        ) : (
                          <Button variant="ghost" size="icon" onClick={() => openEdit(m)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )
                      )}
                    </TableCell>
                  )}
                  {canWrite && (
                    <TableCell>
                      {manageable && (
                        <Button variant="ghost" size="icon" onClick={() => { setPasswordTarget(m); setNewPassword(''); setConfirmPassword(''); }}>
                          <KeyRound className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  )}
                  {canWrite && (
                    <TableCell>
                      {deletable && (
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeleteTarget(m)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
            {members.length === 0 && (
              <TableRow>
                <TableCell colSpan={colCount} className="text-center text-muted-foreground py-8">
                  No team members found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Cleaner Performance (admin/manager) */}
      {(currentRole === 'owner' || currentRole === 'admin' || currentRole === 'manager') && (
        <CleanerPerformance />
      )}

      {/* Bar Chart */}
      {chartData.length > 0 && (
        <div className="rounded-lg border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">Leads per Team Member</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="leads" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Add/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Member' : 'Add New Member'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={form.role}
                onValueChange={(v) => {
                  const newRole = v as Role;
                  setForm({ ...form, role: newRole, lead_id: newRole === 'client' ? form.lead_id : null });
                }}
                disabled={!!editingId}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {allowedRoles.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r.charAt(0).toUpperCase() + r.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {form.role === 'client' && !editingId ? (
              <ClientLeadPicker
                form={form}
                onPick={(lead) =>
                  setForm({
                    ...form,
                    lead_id: lead.id,
                    name: lead.full_name,
                    email: lead.email ?? '',
                    phone: lead.phone ?? '',
                  })
                }
                onClear={() => setForm({ ...form, lead_id: null, name: '', email: '', phone: '' })}
              />
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Name *</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Email *</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    disabled={!!editingId}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
              </>
            )}
            {form.role === 'cleaner' && (
              <div className="space-y-2">
                <Label>Cleaner Type</Label>
                <Select
                  value={form.cleaner_type || ''}
                  onValueChange={(v) => setForm({ ...form, cleaner_type: v as CleanerType })}
                >
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    {CLEANER_TYPES.map((c) => (
                      <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            {editingId && (
              <Button
                variant="secondary"
                onClick={handleResetPassword}
                disabled={resettingPassword}
                className="sm:mr-auto"
              >
                {resettingPassword && <Loader2 className="h-4 w-4 animate-spin" />}
                Reset to Default
              </Button>
            )}
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingId ? 'Save Changes' : 'Add Member'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Team Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {deleteTarget?.name}? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Change Password Modal */}
      <Dialog open={!!passwordTarget} onOpenChange={(open) => { if (!open) setPasswordTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password — {passwordTarget?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>New Password *</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 8 characters"
              />
            </div>
            <div className="space-y-2">
              <Label>Confirm Password *</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordTarget(null)}>Cancel</Button>
            <Button onClick={handleChangePassword} disabled={changingPassword}>
              {changingPassword && <Loader2 className="h-4 w-4 animate-spin" />}
              Update Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MemberStatsDialog member={statsTarget} onClose={() => setStatsTarget(null)} />
    </div>
  );
}

interface LeadOption {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
}

function ClientLeadPicker({
  form,
  onPick,
  onClear,
}: {
  form: MemberForm;
  onPick: (lead: LeadOption) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState('');

  const { data: usedLeadIds = new Set<string>() } = useQuery({
    queryKey: ['client-team-lead-ids'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_members')
        .select('lead_id')
        .eq('role', 'client');
      if (error) throw error;
      return new Set((data ?? []).map((r: any) => r.lead_id).filter(Boolean) as string[]);
    },
  });

  const { data: results = [], isFetching } = useQuery({
    queryKey: ['client-lead-search', query],
    enabled: !form.lead_id && query.trim().length > 0,
    queryFn: async () => {
      const q = query.trim().replace(/[%,]/g, '');
      const { data, error } = await supabase
        .from('leads')
        .select('id, full_name, email, phone')
        .or(`full_name.ilike.%${q}%,email.ilike.%${q}%`)
        .limit(20);
      if (error) throw error;
      return (data ?? []) as LeadOption[];
    },
  });

  const filtered = results.filter((l) => !usedLeadIds.has(l.id));

  if (form.lead_id) {
    return (
      <div className="space-y-2">
        <Label>Linked Lead *</Label>
        <div className="rounded-md border bg-muted/30 p-3 flex items-start justify-between gap-2">
          <div className="text-sm min-w-0">
            <p className="font-medium truncate">{form.name}</p>
            <p className="text-xs text-muted-foreground truncate">{form.email}</p>
            {form.phone && <p className="text-xs text-muted-foreground truncate">{form.phone}</p>}
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onClear} className="gap-1 shrink-0">
            <X className="h-3 w-3" /> Change
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label>Search Lead *</Label>
      <div className="relative">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or email…"
          className="pl-8"
        />
      </div>
      {query.trim().length > 0 && (
        <div className="rounded-md border max-h-56 overflow-y-auto">
          {isFetching ? (
            <div className="p-3 text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" /> Searching…
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-3 text-sm text-muted-foreground">No matching leads</div>
          ) : (
            filtered.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => { onPick(l); setQuery(''); }}
                className="w-full text-left px-3 py-2 hover:bg-muted/60 border-b last:border-b-0"
              >
                <p className="text-sm font-medium">{l.full_name}</p>
                <p className="text-xs text-muted-foreground">{l.email ?? 'No email'}</p>
              </button>
            ))
          )}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Only leads without an existing client account are shown.
      </p>
    </div>
  );
}

