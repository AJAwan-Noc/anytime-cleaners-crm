import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { ActivityLog } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

const PAGE_SIZE = 50;

const EVENT_COLOR = (e: string) => {
  if (e.startsWith('lead_')) return 'bg-blue-100 text-blue-800';
  if (e.startsWith('job_')) return 'bg-green-100 text-green-800';
  if (e.startsWith('invoice_')) return 'bg-amber-100 text-amber-800';
  if (e.startsWith('team_')) return 'bg-purple-100 text-purple-800';
  if (e.startsWith('note_')) return 'bg-gray-100 text-gray-800';
  return 'bg-slate-100 text-slate-800';
};

export default function ActivityPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(0);
  const [eventType, setEventType] = useState<string>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [newCount, setNewCount] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ['activity_log', page, eventType, from, to],
    queryFn: async () => {
      let q = supabase
        .from('activity_log')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      if (eventType !== 'all') q = q.eq('event_type', eventType);
      if (from) q = q.gte('created_at', from);
      if (to) q = q.lte('created_at', new Date(new Date(to).getTime() + 86400000).toISOString());
      const { data, count, error } = await q;
      if (error) throw error;
      return { rows: (data ?? []) as ActivityLog[], count: count ?? 0 };
    },
  });

  const rows = data?.rows ?? [];
  const total = data?.count ?? 0;
  const latestId = rows[0]?.id;

  // Poll every 30s for new entries
  useEffect(() => {
    if (page !== 0) return;
    const t = setInterval(async () => {
      const { data: newest } = await supabase.from('activity_log').select('id').order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (newest && newest.id !== latestId) {
        const { count } = await supabase
          .from('activity_log')
          .select('id', { count: 'exact', head: true })
          .gt('created_at', rows[0]?.created_at ?? '1970-01-01');
        setNewCount(count ?? 0);
      }
    }, 30000);
    return () => clearInterval(t);
  }, [latestId, page, rows]);

  const refresh = () => {
    setNewCount(0);
    qc.invalidateQueries({ queryKey: ['activity_log'] });
  };

  const eventTypes = useMemo(() => [
    'all', 'lead_created', 'lead_stage_changed', 'note_added',
    'invoice_created', 'invoice_paid', 'team_member_created',
    'team_member_deleted', 'job_created', 'job_started', 'job_completed',
  ], []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Activity Feed</h1>
        <Button variant="outline" size="sm" onClick={refresh} className="gap-1"><RefreshCw className="h-4 w-4" /> Refresh</Button>
      </div>

      {newCount > 0 && (
        <button
          onClick={refresh}
          className="w-full bg-primary text-primary-foreground py-2 rounded-md text-sm font-medium hover:opacity-90"
        >
          {newCount} new {newCount === 1 ? 'activity' : 'activities'} — click to refresh
        </button>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Select value={eventType} onValueChange={(v) => { setEventType(v); setPage(0); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {eventTypes.map((e) => <SelectItem key={e} value={e}>{e === 'all' ? 'All Events' : e}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(0); }} placeholder="From" />
          <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(0); }} placeholder="To" />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : rows.length === 0 ? (
            <p className="text-center py-12 text-sm text-muted-foreground">No activity found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm" title={format(new Date(r.created_at), 'PPpp')}>
                      {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell className="text-sm">{r.actor_name ?? '—'}</TableCell>
                    <TableCell><Badge className={EVENT_COLOR(r.event_type)} variant="secondary">{r.event_type}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.entity_type ?? '—'}</TableCell>
                    <TableCell className="text-sm">{r.description ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          Page {page + 1} of {Math.max(1, Math.ceil(total / PAGE_SIZE))} · {total} total
        </span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Previous</Button>
          <Button variant="outline" size="sm" disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      </div>
    </div>
  );
}
