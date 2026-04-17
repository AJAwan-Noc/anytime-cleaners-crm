import { useMemo, useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { supabase, N8N_BASE_URL } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Job, JOB_STATUS_COLORS, JOB_STATUS_HEX, JOB_STATUS_LABELS, JobStatus, Lead, TeamMember } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Loader2, Play, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { logActivity } from '@/lib/activityLog';

type FilterRange = 'all' | 'today' | 'week' | 'month';

export default function CalendarPage() {
  const qc = useQueryClient();
  const { role, teamMember } = useAuth();
  const calRef = useRef<FullCalendar | null>(null);

  const [filter, setFilter] = useState<FilterRange>('all');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'start' | 'complete' | null>(null);

  const canEdit = role === 'owner' || role === 'admin' || role === 'manager';
  const isCleaner = role === 'cleaner';

  // Fetch jobs scoped to role
  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['jobs', role, teamMember?.id],
    queryFn: async () => {
      let q = supabase
        .from('jobs')
        .select('*, lead:leads(id, full_name, address, email, phone, service_type), assigned_member:team_members!jobs_assigned_to_fkey(id, name)')
        .order('scheduled_date', { ascending: true });

      if (isCleaner && teamMember) {
        q = q.eq('assigned_to', teamMember.id);
      } else if (role === 'agent' && teamMember) {
        const { data: myLeads } = await supabase.from('leads').select('id').eq('assigned_to', teamMember.id);
        const ids = (myLeads ?? []).map((l) => l.id);
        if (ids.length === 0) return [];
        q = q.in('lead_id', ids);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Job[];
    },
    enabled: !!role,
  });

  const filteredJobs = useMemo(() => {
    if (filter === 'all') return jobs;
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    if (filter === 'today') end.setDate(end.getDate() + 1);
    if (filter === 'week') end.setDate(end.getDate() + 7);
    if (filter === 'month') end.setMonth(end.getMonth() + 1);
    return jobs.filter((j) => {
      const d = new Date(j.scheduled_date);
      return d >= start && d < end;
    });
  }, [jobs, filter]);

  const events = filteredJobs.map((j) => {
    const dateTime = `${j.scheduled_date}T${j.scheduled_time}`;
    const start = new Date(dateTime);
    const end = new Date(start.getTime() + (j.estimated_duration_hours ?? 1) * 3600 * 1000);
    return {
      id: j.id,
      title: `${j.lead?.full_name ?? 'Job'} — ${j.lead?.service_type ?? ''}`,
      start: start.toISOString(),
      end: end.toISOString(),
      backgroundColor: JOB_STATUS_HEX[j.status],
      borderColor: JOB_STATUS_HEX[j.status],
      extendedProps: { job: j },
    };
  });

  const updateJobStatus = useMutation({
    mutationFn: async ({ jobId, status, endpoint, eventLabel }: { jobId: string; status: JobStatus; endpoint: string; eventLabel: 'job_started' | 'job_completed'; successMsg: string }) => {
      const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
      if (status === 'in_progress') updates.started_at = new Date().toISOString();
      if (status === 'completed') updates.completed_at = new Date().toISOString();
      const { error } = await supabase.from('jobs').update(updates).eq('id', jobId);
      if (error) throw error;
      console.log(`[calendar] POST /${endpoint}`, { job_id: jobId });
      await fetch(`${N8N_BASE_URL}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: jobId }),
      }).catch((e) => console.error(`n8n /${endpoint} failed`, e));
      await logActivity({
        event_type: eventLabel,
        actor_id: teamMember?.id,
        actor_name: teamMember?.name,
        entity_type: 'job',
        entity_id: jobId,
        description: `${teamMember?.name ?? 'Cleaner'} ${eventLabel === 'job_started' ? 'started' : 'completed'} a job`,
      });
    },
    onSuccess: (_d, vars) => {
      toast.success(vars.successMsg);
      qc.invalidateQueries({ queryKey: ['jobs'] });
      setSelectedJob(null);
      setConfirmAction(null);
    },
    onError: (e: any) => toast.error(e.message ?? 'Failed'),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">Calendar</h1>
          <p className="text-sm text-muted-foreground">
            {isCleaner ? 'Your assigned jobs' : 'All scheduled cleaning jobs'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={filter} onValueChange={(v) => setFilter(v as FilterRange)}>
            <SelectTrigger className="w-[130px] sm:w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Jobs</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
            </SelectContent>
          </Select>
          {canEdit && (
            <Button onClick={() => setCreateOpen(true)} size="sm" className="gap-1 sm:size-default">
              <Plus className="h-4 w-4" /> <span className="hidden xs:inline">Create Job</span><span className="xs:hidden">New</span>
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-2 sm:p-4 overflow-x-auto">
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <div className="min-w-[320px] [&_.fc-toolbar]:flex-wrap [&_.fc-toolbar]:gap-2 [&_.fc-toolbar-title]:text-base sm:[&_.fc-toolbar-title]:text-lg [&_.fc-button]:text-xs sm:[&_.fc-button]:text-sm [&_.fc-button]:px-2 sm:[&_.fc-button]:px-3">
              <FullCalendar
                ref={calRef}
                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                initialView="dayGridMonth"
                headerToolbar={{
                  left: 'prev,next today',
                  center: 'title',
                  right: 'dayGridMonth,timeGridWeek,timeGridDay',
                }}
                events={events}
                eventClick={(info) => {
                  const job = info.event.extendedProps.job as Job;
                  setSelectedJob(job);
                }}
                height="auto"
                nowIndicator
              />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {(['scheduled', 'in_progress', 'completed', 'cancelled'] as JobStatus[]).map((s) => (
          <div key={s} className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: JOB_STATUS_HEX[s] }} />
            {JOB_STATUS_LABELS[s]}
          </div>
        ))}
      </div>

      {/* Job detail modal */}
      <JobDetailDialog
        job={selectedJob}
        open={!!selectedJob}
        onClose={() => setSelectedJob(null)}
        canEdit={canEdit}
        isCleaner={isCleaner}
        onStart={() => setConfirmAction('start')}
        onComplete={() => setConfirmAction('complete')}
        onSaved={() => qc.invalidateQueries({ queryKey: ['jobs'] })}
      />

      {/* Create modal */}
      {canEdit && (
        <CreateJobDialog
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ['jobs'] });
            setCreateOpen(false);
          }}
        />
      )}

      {/* Confirm action */}
      <AlertDialog open={!!confirmAction} onOpenChange={(o) => !o && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction === 'start'
                ? `Start cleaning for ${selectedJob?.lead?.full_name ?? 'this lead'}?`
                : `Mark job complete for ${selectedJob?.lead?.full_name ?? 'this lead'}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === 'start'
                ? 'This will notify the team.'
                : 'This will notify the team and client.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!selectedJob || !confirmAction) return;
                if (confirmAction === 'start') {
                  updateJobStatus.mutate({ jobId: selectedJob.id, status: 'in_progress', endpoint: 'job-started', eventLabel: 'job_started', successMsg: 'Job started — notifications sent' });
                } else {
                  updateJobStatus.mutate({ jobId: selectedJob.id, status: 'completed', endpoint: 'job-completed', eventLabel: 'job_completed', successMsg: 'Job completed — notifications sent' });
                }
              }}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function JobDetailDialog({
  job, open, onClose, canEdit, isCleaner, onStart, onComplete, onSaved,
}: {
  job: Job | null;
  open: boolean;
  onClose: () => void;
  canEdit: boolean;
  isCleaner: boolean;
  onStart: () => void;
  onComplete: () => void;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<Job>>({});
  const { data: cleaners = [] } = useQuery({
    queryKey: ['cleaners'],
    queryFn: async () => {
      const { data } = await supabase.from('team_members').select('id,name').eq('role', 'cleaner').eq('is_active', true);
      return (data ?? []) as { id: string; name: string }[];
    },
    enabled: canEdit,
  });

  const { data: property } = useQuery({
    queryKey: ['job-property', job?.lead_id],
    enabled: !!job?.lead_id,
    queryFn: async () => {
      const { data } = await supabase
        .from('properties')
        .select('access_code, parking_notes, special_instructions, address')
        .eq('lead_id', job!.lead_id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as { access_code: string | null; parking_notes: string | null; special_instructions: string | null; address: string } | null;
    },
  });

  if (!job) return null;

  const start = () => {
    setForm({
      scheduled_date: job.scheduled_date,
      scheduled_time: job.scheduled_time,
      estimated_duration_hours: job.estimated_duration_hours,
      status: job.status,
      assigned_to: job.assigned_to,
      notes: job.notes,
    });
    setEditing(true);
  };

  const save = async () => {
    const { error } = await supabase
      .from('jobs')
      .update({ ...form, updated_at: new Date().toISOString() })
      .eq('id', job.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Job updated');
    setEditing(false);
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setEditing(false); onClose(); } }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Job Details</DialogTitle>
        </DialogHeader>

        {/* Property info — critical for arriving cleaner */}
        <div className="rounded-md border-l-4 border-l-primary bg-muted/40 p-3 text-sm space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Property Details</p>
          {property ? (
            <>
              <PropertyRow label="Entry Code" value={property.access_code || '—'} mono={!!property.access_code} />
              <PropertyRow label="Parking" value={property.parking_notes || '—'} />
              <PropertyRow label="Special Instructions" value={property.special_instructions || '—'} />
            </>
          ) : (
            <p className="text-muted-foreground">No property details on file.</p>
          )}
        </div>

        <div className="space-y-3 text-sm">
          <Row label="Lead" value={job.lead?.full_name ?? '—'} />
          <Row label="Address" value={job.lead?.address ?? '—'} />
          <Row label="Service" value={job.lead?.service_type ?? '—'} />
          <Row label="Cleaner" value={job.assigned_member?.name ?? 'Unassigned'} />
          <Row label="Date" value={`${format(new Date(job.scheduled_date), 'PP')} at ${job.scheduled_time?.slice(0, 5)}`} />
          <Row label="Duration" value={job.estimated_duration_hours ? `${job.estimated_duration_hours}h` : '—'} />
          <div className="flex justify-between">
            <span className="text-muted-foreground">Status</span>
            <Badge className={JOB_STATUS_COLORS[job.status]}>{JOB_STATUS_LABELS[job.status]}</Badge>
          </div>
          {job.notes && <Row label="Notes" value={job.notes} />}
        </div>

        {editing && (
          <div className="space-y-3 border-t pt-3">
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Date</Label><Input type="date" value={form.scheduled_date ?? ''} onChange={(e) => setForm((p) => ({ ...p, scheduled_date: e.target.value }))} /></div>
              <div><Label>Time</Label><Input type="time" value={form.scheduled_time ?? ''} onChange={(e) => setForm((p) => ({ ...p, scheduled_time: e.target.value }))} /></div>
              <div><Label>Duration (hrs)</Label><Input type="number" step="0.5" value={form.estimated_duration_hours ?? ''} onChange={(e) => setForm((p) => ({ ...p, estimated_duration_hours: Number(e.target.value) }))} /></div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v as JobStatus }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(['scheduled', 'in_progress', 'completed', 'cancelled'] as JobStatus[]).map((s) => (
                      <SelectItem key={s} value={s}>{JOB_STATUS_LABELS[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Cleaner</Label>
              <Select value={form.assigned_to ?? ''} onValueChange={(v) => setForm((p) => ({ ...p, assigned_to: v }))}>
                <SelectTrigger><SelectValue placeholder="Select cleaner" /></SelectTrigger>
                <SelectContent>
                  {cleaners.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Notes</Label><Textarea value={form.notes ?? ''} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} /></div>
          </div>
        )}

        <DialogFooter className="flex-wrap gap-2">
          {isCleaner && job.status === 'scheduled' && (
            <Button onClick={onStart} className="gap-1"><Play className="h-4 w-4" /> Start Cleaning</Button>
          )}
          {isCleaner && job.status === 'in_progress' && (
            <Button onClick={onComplete} className="gap-1"><CheckCircle2 className="h-4 w-4" /> Complete Job</Button>
          )}
          {canEdit && !editing && <Button variant="outline" onClick={start}>Edit</Button>}
          {canEdit && editing && <Button onClick={save}>Save</Button>}
          <Button variant="ghost" onClick={() => { setEditing(false); onClose(); }}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 items-start">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-right font-medium break-words min-w-0">{value}</span>
    </div>
  );
}

function PropertyRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3 items-start">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className={`text-right font-medium break-words min-w-0 ${mono ? 'font-mono text-base' : 'text-sm'}`}>{value}</span>
    </div>
  );
}

function CreateJobDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const { teamMember } = useAuth();
  const [form, setForm] = useState({
    lead_id: '',
    assigned_to: '',
    scheduled_date: '',
    scheduled_time: '09:00',
    estimated_duration_hours: 2,
    notes: '',
    is_recurring: false,
  });
  const [search, setSearch] = useState('');

  const { data: leads = [] } = useQuery({
    queryKey: ['booked-leads'],
    queryFn: async () => {
      const { data } = await supabase.from('leads').select('id, full_name, address, service_type').eq('stage', 'booked').eq('is_archived', false).order('full_name');
      return (data ?? []) as Pick<Lead, 'id' | 'full_name' | 'address' | 'service_type'>[];
    },
  });

  const { data: cleaners = [] } = useQuery({
    queryKey: ['cleaners'],
    queryFn: async () => {
      const { data } = await supabase.from('team_members').select('id,name').eq('role', 'cleaner').eq('is_active', true);
      return (data ?? []) as { id: string; name: string }[];
    },
  });

  const filteredLeads = leads.filter((l) => l.full_name.toLowerCase().includes(search.toLowerCase()));

  const create = async () => {
    if (!form.lead_id || !form.scheduled_date) {
      toast.error('Lead and date are required');
      return;
    }
    const lead = leads.find((l) => l.id === form.lead_id);
    const { data, error } = await supabase
      .from('jobs')
      .insert({
        lead_id: form.lead_id,
        assigned_to: form.assigned_to || null,
        scheduled_date: form.scheduled_date,
        scheduled_time: form.scheduled_time,
        estimated_duration_hours: form.estimated_duration_hours,
        status: 'scheduled',
        notes: form.notes || null,
        is_recurring: form.is_recurring,
      })
      .select()
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    if (!data?.id) {
      toast.error('Job created but no ID returned');
      return;
    }
    console.log('[calendar] POST /job-assigned', { job_id: data.id });
    await fetch(`${N8N_BASE_URL}/job-assigned`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_id: data.id }),
    }).catch((e) => console.error('n8n /job-assigned failed', e));
    await logActivity({
      event_type: 'job_created',
      actor_id: teamMember?.id,
      actor_name: teamMember?.name,
      entity_type: 'job',
      entity_id: data.id,
      entity_name: lead?.full_name,
      description: `Job scheduled for ${lead?.full_name ?? ''}`,
    });
    toast.success('Job created');
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Create Job</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Lead (booked)</Label>
            <Input
              placeholder="Search lead…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="mt-1"
            />
            <div className="mt-2 max-h-48 overflow-y-auto rounded-md border border-input bg-background">
              {filteredLeads.length === 0 ? (
                <div className="px-3 py-2 text-sm text-muted-foreground">No booked leads</div>
              ) : (
                filteredLeads.map((l) => {
                  const selected = form.lead_id === l.id;
                  return (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, lead_id: l.id }))}
                      className={`flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground ${
                        selected ? 'bg-accent text-accent-foreground' : ''
                      }`}
                    >
                      <span className="font-medium">{l.full_name}</span>
                      {l.address && (
                        <span className="text-xs text-muted-foreground line-clamp-1">{l.address}</span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
          <div>
            <Label>Assigned Cleaner</Label>
            <Select value={form.assigned_to} onValueChange={(v) => setForm((p) => ({ ...p, assigned_to: v }))}>
              <SelectTrigger><SelectValue placeholder="Select cleaner" /></SelectTrigger>
              <SelectContent>
                {cleaners.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Date</Label><Input type="date" value={form.scheduled_date} onChange={(e) => setForm((p) => ({ ...p, scheduled_date: e.target.value }))} /></div>
            <div><Label>Time</Label><Input type="time" value={form.scheduled_time} onChange={(e) => setForm((p) => ({ ...p, scheduled_time: e.target.value }))} /></div>
          </div>
          <div><Label>Estimated Duration (hours)</Label><Input type="number" step="0.5" value={form.estimated_duration_hours} onChange={(e) => setForm((p) => ({ ...p, estimated_duration_hours: Number(e.target.value) }))} /></div>
          <div><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} /></div>
          <div className="flex items-center justify-between">
            <Label>Recurring Job</Label>
            <Switch checked={form.is_recurring} onCheckedChange={(v) => setForm((p) => ({ ...p, is_recurring: v }))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={create}>Create Job</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
