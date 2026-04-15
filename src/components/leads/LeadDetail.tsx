import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, N8N_BASE_URL } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import {
  Lead, TeamMember, LeadUpdate, Invoice, LeadStage, LeadSource, UpdateType,
  STAGE_LABELS, STAGE_COLORS, UPDATE_TYPE_COLORS, INVOICE_STATUS_COLORS,
} from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, Archive, FileText, BarChart3 } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

const SOURCES: LeadSource[] = ['website', 'facebook', 'instagram', 'referral', 'google', 'manual', 'other'];
const STAGES: LeadStage[] = ['new_lead', 'contacted', 'not_responding', 'booked', 'not_interested'];
const SERVICE_TYPES = ['Regular Cleaning', 'Deep Clean', 'Move-In-Out', 'Commercial', 'Window Cleaning', 'Other'];
const UPDATE_TYPES: UpdateType[] = ['Note', 'Call', 'Email', 'SMS', 'Stage Change', 'System'];

export default function LeadDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { role, teamMember } = useAuth();
  const isAgent = role === 'agent';

  const [form, setForm] = useState<Partial<Lead>>({});
  const [newMessage, setNewMessage] = useState('');
  const [newUpdateType, setNewUpdateType] = useState<UpdateType>('Note');

  const { data: lead, isLoading } = useQuery({
    queryKey: ['lead', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('leads').select('*').eq('id', id!).single();
      if (error) throw error;
      return data as Lead;
    },
    enabled: !!id,
  });

  const { data: members = [] } = useQuery({
    queryKey: ['team-members-active'],
    queryFn: async () => {
      const { data, error } = await supabase.from('team_members').select('*').eq('is_active', true);
      if (error) throw error;
      return data as TeamMember[];
    },
  });

  const { data: updates = [] } = useQuery({
    queryKey: ['lead-updates', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_updates')
        .select('*')
        .eq('lead_id', id!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as LeadUpdate[];
    },
    enabled: !!id,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['lead-invoices', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('lead_id', id!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Invoice[];
    },
    enabled: !!id && !isAgent,
  });

  useEffect(() => {
    if (lead) setForm(lead);
  }, [lead]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const updates: Partial<Lead> = isAgent
        ? { stage: form.stage }
        : {
            full_name: form.full_name,
            email: form.email,
            phone: form.phone,
            address: form.address,
            service_type: form.service_type,
            source: form.source,
            stage: form.stage,
            assigned_to: form.assigned_to,
            notes: form.notes,
          };
      const { error } = await supabase.from('leads').update(updates).eq('id', id!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Lead updated');
      queryClient.invalidateQueries({ queryKey: ['lead', id] });
      queryClient.invalidateQueries({ queryKey: ['leads-list'] });
    },
    onError: () => toast.error('Failed to update lead'),
  });

  const addUpdateMutation = useMutation({
    mutationFn: async (optimistic: LeadUpdate) => {
      const typeMap: Record<UpdateType, string> = {
        Note: 'note', Call: 'call', Email: 'email', SMS: 'sms',
        'Stage Change': 'stage_change', System: 'system',
      };
      const { error } = await supabase.from('lead_updates').insert({
        lead_id: id,
        author_id: teamMember?.user_id ?? null,
        author_name: optimistic.author_name,
        message: optimistic.message,
        update_type: typeMap[optimistic.update_type] ?? optimistic.update_type.toLowerCase(),
      });
      if (error) throw error;
    },
    onMutate: async (optimistic: LeadUpdate) => {
      await queryClient.cancelQueries({ queryKey: ['lead-updates', id] });
      const previous = queryClient.getQueryData<LeadUpdate[]>(['lead-updates', id]);
      queryClient.setQueryData<LeadUpdate[]>(['lead-updates', id], (old = []) => [optimistic, ...old]);
      setNewMessage('');
      setNewUpdateType('Note');
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(['lead-updates', id], context.previous);
      toast.error('Failed to add update');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-updates', id] });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('leads').update({ is_archived: true }).eq('id', id!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Lead archived');
      navigate('/leads');
    },
    onError: () => toast.error('Failed to archive lead'),
  });

  const webhookAction = async (endpoint: string, body: Record<string, unknown>, label: string) => {
    try {
      const res = await fetch(`${N8N_BASE_URL}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      toast.success(`${label} requested`);
    } catch {
      toast.error(`Failed to request ${label}`);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!lead) {
    return <p className="text-center py-12 text-muted-foreground">Lead not found.</p>;
  }

  const set = (key: keyof Lead, val: string | null) => setForm((prev) => ({ ...prev, [key]: val }));

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={() => navigate('/leads')} className="gap-1">
        <ArrowLeft className="h-4 w-4" /> Back to Leads
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left panel — fields + timeline */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Lead Details</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Full Name" value={form.full_name ?? ''} onChange={(v) => set('full_name', v)} disabled={isAgent} />
              <Field label="Email" value={form.email ?? ''} onChange={(v) => set('email', v)} disabled={isAgent} />
              <Field label="Phone" value={form.phone ?? ''} onChange={(v) => set('phone', v)} disabled={isAgent} />
              <Field label="Address" value={form.address ?? ''} onChange={(v) => set('address', v)} disabled={isAgent} />

              <div className="space-y-1.5">
                <Label>Service Type</Label>
                <Select value={form.service_type ?? ''} onValueChange={(v) => set('service_type', v)} disabled={isAgent}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SERVICE_TYPES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Source</Label>
                <Select value={form.source ?? ''} onValueChange={(v) => set('source', v as LeadSource)} disabled={isAgent}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SOURCES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Stage</Label>
                <Select value={form.stage ?? ''} onValueChange={(v) => set('stage', v as LeadStage)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STAGES.map((s) => <SelectItem key={s} value={s}>{STAGE_LABELS[s]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {!isAgent && (
                <div className="space-y-1.5">
                  <Label>Assigned To</Label>
                  <Select value={form.assigned_to ?? 'unassigned'} onValueChange={(v) => set('assigned_to', v === 'unassigned' ? null : v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {!isAgent && (
                <div className="space-y-1.5 md:col-span-2">
                  <Label>Notes</Label>
                  <Textarea value={form.notes ?? ''} onChange={(e) => set('notes', e.target.value)} rows={3} />
                </div>
              )}

              <div className="md:col-span-2">
                <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                  {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle>Activity Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {updates.length === 0 && (
                <p className="text-sm text-muted-foreground">No activity yet.</p>
              )}
              {updates.map((u) => (
                <div key={u.id} className="flex gap-3 border-b pb-3 last:border-0">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{u.author_name}</span>
                      <Badge className={UPDATE_TYPE_COLORS[u.update_type]} variant="secondary">
                        {u.update_type}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(u.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-sm text-foreground">{u.message}</p>
                  </div>
                </div>
              ))}

              {/* Add update */}
              <div className="border-t pt-4 space-y-3">
                <Textarea
                  placeholder="Add an update…"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  rows={2}
                />
                <div className="flex items-center gap-2">
                  <Select value={newUpdateType} onValueChange={(v) => setNewUpdateType(v as UpdateType)}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UPDATE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={() => {
                      const optimistic: LeadUpdate = {
                        id: crypto.randomUUID(),
                        lead_id: id!,
                        author_id: teamMember?.user_id ?? null,
                        author_name: teamMember?.name ?? 'Unknown',
                        message: newMessage.trim(),
                        update_type: newUpdateType,
                        created_at: new Date().toISOString(),
                      };
                      addUpdateMutation.mutate(optimistic);
                    }}
                    disabled={!newMessage.trim() || addUpdateMutation.isPending}
                    size="sm"
                  >
                    Submit
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right panel — actions (admin/manager only) */}
        {!isAgent && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  className="w-full justify-start gap-2"
                  variant="outline"
                  onClick={() =>
                    webhookAction('create-invoice', {
                      lead_id: id,
                      service_date: format(new Date(), 'yyyy-MM-dd'),
                    }, 'Invoice generation')
                  }
                >
                  <FileText className="h-4 w-4" /> Generate Invoice
                </Button>
                <Button
                  className="w-full justify-start gap-2"
                  variant="outline"
                  onClick={() =>
                    webhookAction('manager-report', {
                      lead_id: id,
                      requested_by: teamMember?.name ?? 'Unknown',
                    }, 'Manager report')
                  }
                >
                  <BarChart3 className="h-4 w-4" /> Manager Report
                </Button>
                <Button
                  className="w-full justify-start gap-2"
                  variant="destructive"
                  onClick={() => archiveMutation.mutate()}
                  disabled={archiveMutation.isPending}
                >
                  {archiveMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Archive className="h-4 w-4" />
                  )}
                  Archive Lead
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Invoices</CardTitle>
              </CardHeader>
              <CardContent>
                {invoices.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No invoices yet.</p>
                ) : (
                  <div className="space-y-2">
                    {invoices.map((inv) => (
                      <div
                        key={inv.id}
                        className="flex items-center justify-between border rounded-md p-2 text-sm cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/invoices/${inv.id}`)}
                      >
                        <span className="font-mono">{inv.invoice_number}</span>
                        <span>${inv.total.toFixed(2)}</span>
                        <Badge className={INVOICE_STATUS_COLORS[inv.status]} variant="secondary">
                          {inv.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} />
    </div>
  );
}
