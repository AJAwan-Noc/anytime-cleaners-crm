import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, N8N_BASE_URL } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { RecurringSchedule, ScheduleType, DaySchedule } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Repeat, Loader2, CalendarPlus } from 'lucide-react';
import { toast } from 'sonner';
import { format, addDays, addMonths, addWeeks, getDay } from 'date-fns';
import { logActivity } from '@/lib/activityLog';
import RecurringScheduleFields, {
  RecurringScheduleValue, emptyRecurringValue, buildRecurringPayload, TYPE_LABELS, WEEKDAYS,
} from '@/components/recurring/RecurringScheduleFields';

const WEEKDAY_INDEX: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
};

/** Compute the next occurrence (date + time) for a recurring schedule. Returns null if none. */
function computeNextOccurrence(s: RecurringSchedule): { date: string; time: string } | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const baseStr = s.last_generated_date ?? s.start_date;
  if (!baseStr) return null;
  const base = new Date(baseStr);
  base.setHours(0, 0, 0, 0);
  const defaultTime = s.scheduled_time?.slice(0, 5) ?? '09:00';

  let next: Date | null = null;
  let nextTime = defaultTime;

  switch (s.schedule_type) {
    case 'weekly': next = addWeeks(base, 1); break;
    case 'fortnightly': next = addWeeks(base, 2); break;
    case 'monthly': next = addMonths(base, 1); break;
    case 'quarterly': next = addMonths(base, 3); break;
    case 'custom_days': next = addDays(base, s.interval_days ?? 7); break;
    case 'specific_weekdays': {
      const wkdays = ((s.weekdays as string[]) ?? []).map((w) => WEEKDAY_INDEX[w]).filter((x) => x != null);
      if (wkdays.length === 0) return null;
      const start = s.last_generated_date ? addDays(base, 1) : base;
      for (let i = 0; i < 14; i++) {
        const d = addDays(start, i);
        if (wkdays.includes(getDay(d)) && d >= today) { next = d; break; }
      }
      // pick time matching this weekday from day_schedules
      if (next) {
        const dayName = Object.entries(WEEKDAY_INDEX).find(([, idx]) => idx === getDay(next!))?.[0];
        const ds = (s.day_schedules ?? []) as DaySchedule[];
        const match = dayName ? ds.find((d) => d.day === dayName) : null;
        if (match) nextTime = match.time;
      }
      break;
    }
    case 'nth_weekday': {
      const cfg = s.nth_weekday as { week?: number; day?: string } | null;
      if (!cfg?.week || !cfg.day) return null;
      const targetDow = WEEKDAY_INDEX[cfg.day];
      const startMonth = s.last_generated_date ? addMonths(base, 1) : base;
      for (let m = 0; m < 12; m++) {
        const monthStart = new Date(startMonth.getFullYear(), startMonth.getMonth() + m, 1);
        const offset = (targetDow - getDay(monthStart) + 7) % 7;
        const candidate = new Date(monthStart);
        candidate.setDate(1 + offset + (cfg.week - 1) * 7);
        if (candidate.getMonth() === monthStart.getMonth() && candidate >= today) {
          next = candidate;
          break;
        }
      }
      break;
    }
    case 'specific_dates': {
      const dates = ((s.specific_dates as string[]) ?? []).map((d) => new Date(d)).sort((a, b) => a.getTime() - b.getTime());
      next = dates.find((d) => d > today) ?? null;
      break;
    }
  }

  if (!next) return null;
  if (s.end_date && next > new Date(s.end_date)) return null;
  return { date: format(next, 'yyyy-MM-dd'), time: nextTime };
}

export default function RecurringSchedulePanel({ leadId }: { leadId: string }) {
  const qc = useQueryClient();
  const { role, teamMember } = useAuth();
  const canEdit = role === 'owner' || role === 'admin' || role === 'manager';
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringSchedule | null>(null);
  const [generating, setGenerating] = useState(false);

  const { data: schedules = [] } = useQuery({
    queryKey: ['recurring-schedules', leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recurring_schedules')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as RecurringSchedule[];
    },
  });

  const { data: lead } = useQuery({
    queryKey: ['lead-name', leadId],
    queryFn: async () => {
      const { data } = await supabase.from('leads').select('full_name').eq('id', leadId).maybeSingle();
      return data;
    },
  });

  const active = schedules.find((s) => s.is_active);
  const nextOccurrence = active ? computeNextOccurrence(active) : null;

  const deactivate = async (id: string) => {
    const { error } = await supabase.from('recurring_schedules').update({ is_active: false }).eq('id', id);
    if (error) return toast.error(error.message);
    toast.success('Schedule deactivated');
    qc.invalidateQueries({ queryKey: ['recurring-schedules', leadId] });
  };

  const generateNext = async () => {
    if (!active || !nextOccurrence) return;
    setGenerating(true);
    try {
      const { data: job, error } = await supabase
        .from('jobs')
        .insert({
          lead_id: leadId,
          assigned_to: active.assigned_to,
          scheduled_date: nextOccurrence.date,
          scheduled_time: `${nextOccurrence.time}:00`,
          estimated_duration_hours: active.estimated_duration_hours,
          status: 'scheduled',
          notes: active.notes,
          is_recurring: true,
          recurring_schedule_id: active.id,
        })
        .select()
        .single();
      if (error) throw error;
      if (!job?.id) throw new Error('No job ID returned');

      await supabase
        .from('recurring_schedules')
        .update({ last_generated_date: nextOccurrence.date })
        .eq('id', active.id);

      console.log('[recurring] POST /job-assigned', { job_id: job.id, created_by_id: teamMember?.id });
      await fetch(`${N8N_BASE_URL}/job-assigned`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: job.id, created_by_id: teamMember?.id }),
      }).catch((e) => console.error('n8n /job-assigned failed', e));

      await logActivity({
        event_type: 'job_created',
        actor_id: teamMember?.id,
        actor_name: teamMember?.name,
        entity_type: 'job',
        entity_id: job.id,
        entity_name: lead?.full_name,
        description: `Recurring job generated for ${lead?.full_name ?? ''} on ${nextOccurrence.date}`,
      });

      toast.success(`Next job generated for ${nextOccurrence.date}`);
      qc.invalidateQueries({ queryKey: ['recurring-schedules', leadId] });
      qc.invalidateQueries({ queryKey: ['jobs'] });
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to generate job');
    } finally {
      setGenerating(false);
    }
  };

  if (!canEdit) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2"><Repeat className="h-4 w-4" /> Recurring Schedule</CardTitle>
        {!active && (
          <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }} className="gap-1">
            <Plus className="h-4 w-4" /> Add Schedule
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {active ? (
          <div className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Type:</span>{' '}
              <span className="font-medium">
                {TYPE_LABELS[(active.schedule_type === 'custom_days' ? 'every_x_days' : active.schedule_type) as ScheduleType]}
              </span>
            </p>
            {active.schedule_type === 'specific_weekdays' && Array.isArray(active.day_schedules) && active.day_schedules.length > 0 ? (
              <div className="text-muted-foreground">
                <span>Times:</span>{' '}
                <span className="text-foreground">
                  {(active.day_schedules as DaySchedule[]).map((d) => `${d.day.slice(0, 3)} ${d.time}`).join(', ')}
                </span>
              </div>
            ) : (
              <p><span className="text-muted-foreground">Time:</span> {active.scheduled_time?.slice(0, 5)}</p>
            )}
            {active.start_date && <p><span className="text-muted-foreground">From:</span> {format(new Date(active.start_date), 'PP')}</p>}
            {active.end_date && <p><span className="text-muted-foreground">To:</span> {format(new Date(active.end_date), 'PP')}</p>}
            {active.estimated_duration_hours && <p><span className="text-muted-foreground">Duration:</span> {active.estimated_duration_hours}h</p>}
            {active.last_generated_date && <p><span className="text-muted-foreground">Last generated:</span> {format(new Date(active.last_generated_date), 'PP')}</p>}
            {nextOccurrence && (
              <p className="text-primary">
                <span className="text-muted-foreground">Next:</span>{' '}
                <span className="font-semibold">{format(new Date(nextOccurrence.date), 'PP')} at {nextOccurrence.time}</span>
              </p>
            )}
            {active.notes && <p className="text-muted-foreground italic">{active.notes}</p>}
            <div className="flex flex-wrap gap-2 pt-2">
              <Button size="sm" onClick={generateNext} disabled={!nextOccurrence || generating} className="gap-1">
                {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <CalendarPlus className="h-3 w-3" />}
                Generate Next Job
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setEditing(active); setOpen(true); }}>Edit</Button>
              <Button size="sm" variant="destructive" onClick={() => deactivate(active.id)}>Deactivate</Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No active recurring schedule.</p>
        )}
      </CardContent>

      <ScheduleDialog
        open={open}
        onClose={() => setOpen(false)}
        leadId={leadId}
        existing={editing}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ['recurring-schedules', leadId] });
          setOpen(false);
        }}
      />
    </Card>
  );
}

function buildValueFromExisting(existing: RecurringSchedule | null): RecurringScheduleValue {
  if (!existing) return emptyRecurringValue();
  const t: ScheduleType = existing.schedule_type === 'custom_days' ? 'every_x_days' : (existing.schedule_type as ScheduleType);
  const ds = Array.isArray(existing.day_schedules) ? (existing.day_schedules as DaySchedule[]) : [];
  const wk = (existing.weekdays as string[]) ?? [];
  const nthCfg = (existing.nth_weekday ?? {}) as { week?: number; day?: string };
  return {
    type: t,
    startDate: existing.start_date ?? '',
    endDate: existing.end_date ?? '',
    time: existing.scheduled_time?.slice(0, 5) ?? '09:00',
    duration: existing.estimated_duration_hours ?? 2,
    intervalDays: existing.interval_days ?? 7,
    weekdays: wk,
    daySchedules: ds.length ? ds : wk.map((d) => ({ day: d, time: existing.scheduled_time?.slice(0, 5) ?? '09:00' })),
    weekNumber: nthCfg.week ?? 1,
    nthWeekday: nthCfg.day ?? 'monday',
    specificDates: (existing.specific_dates as string[]) ?? [],
  };
}

function ScheduleDialog({
  open, onClose, leadId, existing, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  leadId: string;
  existing: RecurringSchedule | null;
  onSaved: () => void;
}) {
  const [value, setValue] = useState<RecurringScheduleValue>(() => buildValueFromExisting(existing));
  const [assignedTo, setAssignedTo] = useState<string>(existing?.assigned_to ?? '');
  const [notes, setNotes] = useState<string>(existing?.notes ?? '');
  const [saving, setSaving] = useState(false);

  // Re-init when dialog re-opens with a new existing
  useState(() => {
    setValue(buildValueFromExisting(existing));
    setAssignedTo(existing?.assigned_to ?? '');
    setNotes(existing?.notes ?? '');
  });

  const { data: cleaners = [] } = useQuery({
    queryKey: ['cleaners'],
    queryFn: async () => {
      const { data } = await supabase.from('team_members').select('id,name').eq('role', 'cleaner').eq('is_active', true);
      return (data ?? []) as { id: string; name: string }[];
    },
  });

  const save = async () => {
    if (value.type === 'specific_weekdays' && value.weekdays.length === 0) {
      return toast.error('Pick at least one weekday');
    }
    setSaving(true);
    const payload = buildRecurringPayload(value, leadId, assignedTo || null, notes || null);
    const res = existing
      ? await supabase.from('recurring_schedules').update(payload).eq('id', existing.id)
      : await supabase.from('recurring_schedules').insert(payload);
    setSaving(false);
    if (res.error) return toast.error(res.error.message);
    toast.success('Schedule saved');
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{existing ? 'Edit' : 'Add'} Recurring Schedule</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <RecurringScheduleFields value={value} onChange={setValue} />

          <div>
            <Label>Assigned Cleaner</Label>
            <Select value={assignedTo} onValueChange={setAssignedTo}>
              <SelectTrigger><SelectValue placeholder="Select cleaner" /></SelectTrigger>
              <SelectContent>
                {cleaners.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Re-export for legacy imports if needed
export { TYPE_LABELS, WEEKDAYS };
