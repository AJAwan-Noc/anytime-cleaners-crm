import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { X } from 'lucide-react';
import { ScheduleType, DaySchedule } from '@/types';

export const TYPE_LABELS: Record<ScheduleType, string> = {
  weekly: 'Weekly',
  fortnightly: 'Fortnightly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  every_x_days: 'Every X Days',
  specific_weekdays: 'Specific Weekdays',
  nth_weekday: 'Nth Weekday of Month',
  specific_dates: 'Specific Dates',
};

export const WEEKDAYS: { label: string; value: string }[] = [
  { label: 'Monday', value: 'monday' },
  { label: 'Tuesday', value: 'tuesday' },
  { label: 'Wednesday', value: 'wednesday' },
  { label: 'Thursday', value: 'thursday' },
  { label: 'Friday', value: 'friday' },
  { label: 'Saturday', value: 'saturday' },
  { label: 'Sunday', value: 'sunday' },
];

export interface RecurringScheduleValue {
  type: ScheduleType;
  startDate: string;
  endDate: string;
  time: string; // HH:MM (used for all types except specific_weekdays)
  duration: number;
  intervalDays: number;
  weekdays: string[];
  daySchedules: DaySchedule[]; // per-weekday times
  weekNumber: number;
  nthWeekday: string;
  specificDates: string[];
}

export const emptyRecurringValue = (): RecurringScheduleValue => ({
  type: 'weekly',
  startDate: '',
  endDate: '',
  time: '09:00',
  duration: 2,
  intervalDays: 7,
  weekdays: [],
  daySchedules: [],
  weekNumber: 1,
  nthWeekday: 'monday',
  specificDates: [],
});

interface Props {
  value: RecurringScheduleValue;
  onChange: (v: RecurringScheduleValue) => void;
}

export default function RecurringScheduleFields({ value, onChange }: Props) {
  const set = <K extends keyof RecurringScheduleValue>(k: K, v: RecurringScheduleValue[K]) =>
    onChange({ ...value, [k]: v });

  const toggleWeekday = (day: string, checked: boolean) => {
    const nextDays = checked ? [...value.weekdays, day] : value.weekdays.filter((x) => x !== day);
    // sync daySchedules
    const existing = new Map(value.daySchedules.map((d) => [d.day, d.time]));
    const nextDaySchedules: DaySchedule[] = nextDays.map((d) => ({
      day: d,
      time: existing.get(d) ?? value.time ?? '09:00',
    }));
    onChange({ ...value, weekdays: nextDays, daySchedules: nextDaySchedules });
  };

  const setDayTime = (day: string, time: string) => {
    const next = value.daySchedules.map((d) => (d.day === day ? { ...d, time } : d));
    set('daySchedules', next);
  };

  return (
    <div className="space-y-3">
      <div>
        <Label>Schedule Type</Label>
        <Select value={value.type} onValueChange={(v) => set('type', v as ScheduleType)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.keys(TYPE_LABELS) as ScheduleType[]).map((t) => (
              <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {value.type === 'every_x_days' && (
        <div>
          <Label>Interval (days)</Label>
          <Input type="number" min={1} value={value.intervalDays}
            onChange={(e) => set('intervalDays', Number(e.target.value))} />
        </div>
      )}

      {value.type === 'specific_weekdays' && (
        <div className="space-y-2">
          <Label>Weekdays</Label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {WEEKDAYS.map((d) => (
              <label key={d.value} className="flex items-center gap-1.5 text-sm">
                <Checkbox
                  checked={value.weekdays.includes(d.value)}
                  onCheckedChange={(v) => toggleWeekday(d.value, !!v)}
                />
                {d.label.slice(0, 3)}
              </label>
            ))}
          </div>
          {value.daySchedules.length > 0 && (
            <div className="space-y-2 pt-2 border-t">
              <Label className="text-xs text-muted-foreground">Time per day</Label>
              {value.daySchedules.map((d) => {
                const lbl = WEEKDAYS.find((w) => w.value === d.day)?.label ?? d.day;
                return (
                  <div key={d.day} className="flex items-center gap-2">
                    <span className="text-sm w-24">{lbl}</span>
                    <Input
                      type="time"
                      value={d.time}
                      onChange={(e) => setDayTime(d.day, e.target.value)}
                      className="max-w-[140px]"
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {value.type === 'nth_weekday' && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Week #</Label>
            <Select value={String(value.weekNumber)} onValueChange={(v) => set('weekNumber', Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}{n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Weekday</Label>
            <Select value={value.nthWeekday} onValueChange={(v) => set('nthWeekday', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {WEEKDAYS.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {value.type === 'specific_dates' && (
        <SpecificDatesField value={value.specificDates} onChange={(d) => set('specificDates', d)} />
      )}

      {value.type !== 'specific_dates' && (
        <div className="grid grid-cols-2 gap-2">
          <div><Label>Start Date</Label><Input type="date" value={value.startDate}
            onChange={(e) => set('startDate', e.target.value)} /></div>
          <div><Label>End Date</Label><Input type="date" value={value.endDate}
            onChange={(e) => set('endDate', e.target.value)} /></div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        {value.type !== 'specific_weekdays' && (
          <div><Label>Time</Label><Input type="time" value={value.time}
            onChange={(e) => set('time', e.target.value)} /></div>
        )}
        <div className={value.type !== 'specific_weekdays' ? '' : 'col-span-2'}>
          <Label>Duration (hrs)</Label>
          <Input type="number" step="0.5" value={value.duration}
            onChange={(e) => set('duration', Number(e.target.value))} />
        </div>
      </div>
    </div>
  );
}

function SpecificDatesField({ value, onChange }: { value: string[]; onChange: (d: string[]) => void }) {
  return (
    <div>
      <Label>Specific Dates</Label>
      <div className="flex gap-2 mt-1">
        <Input
          type="date"
          onChange={(e) => {
            const d = e.target.value;
            if (d && !value.includes(d)) onChange([...value, d]);
            e.target.value = '';
          }}
        />
      </div>
      <div className="flex flex-wrap gap-1 mt-2">
        {value.map((d) => (
          <span key={d} className="inline-flex items-center gap-1 text-xs bg-muted px-2 py-1 rounded">
            {d}
            <X className="h-3 w-3 cursor-pointer" onClick={() => onChange(value.filter((x) => x !== d))} />
          </span>
        ))}
      </div>
    </div>
  );
}

/** Build DB payload from a RecurringScheduleValue. */
export function buildRecurringPayload(v: RecurringScheduleValue, leadId: string, assignedTo: string | null, notes: string | null) {
  const dbType = v.type === 'every_x_days' ? 'custom_days' : v.type;
  // For specific_weekdays, set scheduled_time to the first day's time so legacy logic keeps working.
  const time = v.type === 'specific_weekdays'
    ? (v.daySchedules[0]?.time ?? v.time)
    : v.time;
  return {
    lead_id: leadId,
    schedule_type: dbType,
    interval_days: v.type === 'every_x_days' ? v.intervalDays : null,
    weekdays: v.type === 'specific_weekdays' ? v.weekdays : null,
    nth_weekday: v.type === 'nth_weekday' ? { week: v.weekNumber, day: v.nthWeekday } : null,
    specific_dates: v.type === 'specific_dates' ? v.specificDates : null,
    day_schedules: v.type === 'specific_weekdays' ? v.daySchedules : null,
    start_date: v.startDate || null,
    end_date: v.endDate || null,
    scheduled_time: `${time}:00`,
    estimated_duration_hours: v.duration,
    assigned_to: assignedTo || null,
    notes: notes || null,
    is_active: true,
    updated_at: new Date().toISOString(),
  };
}
