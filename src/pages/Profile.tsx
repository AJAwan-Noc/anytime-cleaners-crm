import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, N8N_BASE_URL } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, KeyRound, Pencil } from 'lucide-react';
import { toast } from 'sonner';

const ROLE_COLORS: Record<string, string> = {
  owner: 'bg-purple-100 text-purple-800',
  admin: 'bg-indigo-100 text-indigo-800',
  manager: 'bg-blue-100 text-blue-800',
  agent: 'bg-emerald-100 text-emerald-800',
  cleaner: 'bg-amber-100 text-amber-800',
  client: 'bg-gray-100 text-gray-800',
};

export default function Profile() {
  const qc = useQueryClient();
  const { teamMember, user, role } = useAuth();
  const [editing, setEditing] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [name, setName] = useState(teamMember?.name ?? '');
  const [phone, setPhone] = useState(teamMember?.phone ?? '');
  const [saving, setSaving] = useState(false);

  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  if (!teamMember) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('team_members')
      .update({ name, phone: phone || null })
      .eq('id', teamMember.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success('Profile updated');
    setEditing(false);
    qc.invalidateQueries();
  };

  const changePassword = async () => {
    if (newPw.length < 8) return toast.error('Password must be at least 8 characters');
    if (newPw !== confirmPw) return toast.error('Passwords do not match');
    setPwSaving(true);
    try {
      const res = await fetch(`${N8N_BASE_URL}/update-team-member-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user?.id, new_password: newPw }),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success('Password updated');
      setNewPw('');
      setConfirmPw('');
      setPwOpen(false);
    } catch {
      toast.error('Failed to update password');
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">My Profile</h1>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Account</CardTitle>
          <div className="flex gap-2">
            {!editing && (
              <Button size="sm" variant="outline" onClick={() => setEditing(true)} className="gap-1">
                <Pencil className="h-3 w-3" /> Edit
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => setPwOpen(true)} className="gap-1">
              <KeyRound className="h-3 w-3" /> Change Password
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {editing ? (
            <>
              <div>
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" onClick={() => { setEditing(false); setName(teamMember.name); setPhone(teamMember.phone ?? ''); }}>Cancel</Button>
                <Button onClick={save} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Save
                </Button>
              </div>
            </>
          ) : (
            <div className="space-y-3 text-sm">
              <Row label="Name" value={teamMember.name} />
              <Row label="Email" value={teamMember.email} />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Role</span>
                <Badge className={ROLE_COLORS[role ?? 'cleaner']} variant="secondary">{role}</Badge>
              </div>
              <Row label="Phone" value={teamMember.phone || '—'} />
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={pwOpen} onOpenChange={(o) => { if (!o) { setPwOpen(false); setNewPw(''); setConfirmPw(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>New Password</Label>
              <Input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
            </div>
            <div>
              <Label>Confirm Password</Label>
              <Input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPwOpen(false)}>Cancel</Button>
            <Button onClick={changePassword} disabled={pwSaving}>
              {pwSaving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Update Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
