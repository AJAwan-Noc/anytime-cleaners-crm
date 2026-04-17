import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { RecurringSchedule, ScheduleType } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Repeat, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const TYPE_LABELS: Record<ScheduleType, string> = {
  weekly: 'Weekly',
  fortnightly: 'Fortnightly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  every_x_days: 'Every X Days',
  specific_weekdays: 'Specific Weekdays',
  nth_weekday: 'Nth Weekday of Month',
  specific_dates: 'Specific Dates',
};

const WEEKDAYS: { label: string; value: string }[] = [
  { label: 'Mon', value: 'monday' },
  { label: 'Tue', value: 'tuesday' },
  { label: 'Wed', value: 'wednesday' },
  { label: 'Thu', value: 'thursday' },
  { label: 'Fri', value: 'friday' },
  { label: 'Sat', value: 'saturday' },
  { label: 'Sun', value: 'sunday' },
];

export default function RecurringSchedulePanel({ leadId }: { leadId: string }) {
  const qc = useQueryClient();
  const { role } = useAuth();
  const canEdit = role === 'owner' || role === 'admin' || role === 'manager';
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringSchedule | null>(null);

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

  const active = schedules.find((s) => s.is_active);

  const deactivate = async (id: string) => {
    const { error } = await supabase.from('recurring_schedules').update({ is_active: false }).eq('id', id);
    if (error) return toast.error(error.message);
    toast.success('Schedule deactivated');
    qc.invalidateQueries({ queryKey: ['recurring-schedules', leadId] });
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
            <p><span className="text-muted-foreground">Type:</span> <span className="font-medium">{TYPE_LABELS[(active.schedule_type === 'custom_days' ? 'every_x_days' : active.schedule_type) as ScheduleType]}</span></p>
            <p><span className="text-muted-foreground">Time:</span> {active.scheduled_time?.slice(0, 5)}</p>
            {active.start_date && <p><span className="text-muted-foreground">From:</span> {format(new Date(active.start_date), 'PP')}</p>}
            {active.end_date && <p><span className="text-muted-foreground">To:</span> {format(new Date(active.end_date), 'PP')}</p>}
            {active.estimated_duration_hours && <p><span className="text-muted-foreground">Duration:</span> {active.estimated_duration_hours}h</p>}
            {active.notes && <p className="text-muted-foreground italic">{active.notes}</p>}
            <div className="flex gap-2 pt-2">
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

function ScheduleDialog({
  open, onClose, leadId, existing, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  leadId: string;
  existing: RecurringSchedule | null;
  onSaved: () => void;
}) {
  const initialType: ScheduleType = existing?.schedule_type === 'custom_days' ? 'every_x_days' : (existing?.schedule_type as ScheduleType) ?? 'weekly';
  const [type, setType] = useState<ScheduleType>(initialType);
  const [startDate, setStartDate] = useState<string>(existing?.start_date ?? '');
  const [endDate, setEndDate] = useState<string>(existing?.end_date ?? '');
  const [time, setTime] = useState(existing?.scheduled_time?.slice(0, 5) ?? '09:00');
  const [duration, setDuration] = useState<number>(existing?.estimated_duration_hours ?? 2);
  const [assignedTo, setAssignedTo] = useState<string>(existing?.assigned_to ?? '');
  const [notes, setNotes] = useState<string>(existing?.notes ?? '');
  const [intervalDays, setIntervalDays] = useState<number>(existing?.interval_days ?? 7);
  const [weekdays, setWeekdays] = useState<string[]>((existing?.weekdays as string[]) ?? []);
  const nthCfg = (existing?.nth_weekday ?? {}) as { week?: number; day?: string };
  const [weekNumber, setWeekNumber] = useState<number>(nthCfg.week ?? 1);
  const [nthWeekday, setNthWeekday] = useState<string>(nthCfg.day ?? 'monday');
  const [specificDates, setSpecificDates] = useState<string[]>((existing?.specific_dates as string[]) ?? []);
  const [newDate, setNewDate] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: cleaners = [] } = useQuery({
    queryKey: ['cleaners'],
    queryFn: async () => {
      const { data } = await supabase.from('team_members').select('id,name').eq('role', 'cleaner').eq('is_active', true);
      return (data ?? []) as { id: string; name: string }[];
    },
  });

  const save = async () => {
    setSaving(true);
    // DB schema uses separate columns. The schema_type 'every_x_days' must map to 'custom_days'.
    const dbType = type === 'every_x_days' ? 'custom_days' : type;
    const payload = {
      lead_id: leadId,
      schedule_type: dbType,
      interval_days: type === 'every_x_days' ? intervalDays : null,
      weekdays: type === 'specific_weekdays' ? weekdays : null,
      nth_weekday: type === 'nth_weekday' ? { week: weekNumber, day: nthWeekday } : null,
      specific_dates: type === 'specific_dates' ? specificDates : null,
      start_date: startDate || null,
      end_date: endDate || null,
      scheduled_time: time + ':00',
      estimated_duration_hours: duration,
      assigned_to: assignedTo || null,
      notes: notes || null,
      is_active: true,
      updated_at: new Date().toISOString(),
    };
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
          <div>
            <Label>Schedule Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as ScheduleType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(TYPE_LABELS) as ScheduleType[]).map((t) => (
                  <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {type === 'every_x_days' && (
            <div><Label>Interval (days)</Label><Input type="number" min={1} value={intervalDays} onChange={(e) => setIntervalDays(Number(e.target.value))} /></div>
          )}

          {type === 'specific_weekdays' && (
            <div>
              <Label>Weekdays</Label>
              <div className="flex flex-wrap gap-3 mt-1">
                {WEEKDAYS.map((d) => (
                  <label key={d} className="flex items-center gap-1 text-sm">
                    <Checkbox checked={weekdays.includes(d)} onCheckedChange={(v) => setWeekdays((p) => v ? [...p, d] : p.filter((x) => x !== d))} />
                    {d}
                  </label>
                ))}
              </div>
            </div>
          )}

          {type === 'nth_weekday' && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Week #</Label>
                <Select value={String(weekNumber)} onValueChange={(v) => setWeekNumber(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4].map((n) => <SelectItem key={n} value={String(n)}>{n}{n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Weekday</Label>
                <Select value={nthWeekday} onValueChange={setNthWeekday}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {WEEKDAYS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {type === 'specific_dates' && (
            <div>
              <Label>Specific Dates</Label>
              <div className="flex gap-2 mt-1">
                <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
                <Button type="button" onClick={() => { if (newDate && !specificDates.includes(newDate)) { setSpecificDates([...specificDates, newDate]); setNewDate(''); } }}>Add</Button>
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {specificDates.map((d) => (
                  <span key={d} className="inline-flex items-center gap-1 text-xs bg-muted px-2 py-1 rounded">
                    {d}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => setSpecificDates(specificDates.filter((x) => x !== d))} />
                  </span>
                ))}
              </div>
            </div>
          )}

          {type !== 'specific_dates' && (
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Start Date</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
              <div><Label>End Date</Label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div><Label>Time</Label><Input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></div>
            <div><Label>Duration (hrs)</Label><Input type="number" step="0.5" value={duration} onChange={(e) => setDuration(Number(e.target.value))} /></div>
          </div>

          <div>
            <Label>Assigned Cleaner</Label>
            <Select value={assignedTo} onValueChange={setAssignedTo}>
              <SelectTrigger><SelectValue placeholder="Select cleaner" /></SelectTrigger>
              <SelectContent>
                {cleaners.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
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
