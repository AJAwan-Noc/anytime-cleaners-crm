import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { TeamMember } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Loader2 } from 'lucide-react';

interface CleanerStats {
  member: TeamMember;
  total: number;
  thisMonth: number;
  avgRating: number | null;
}

const CLEANER_TYPE_LABELS: Record<string, string> = {
  residential: 'Residential',
  commercial: 'Commercial',
  specialist: 'Specialist',
  general: 'General',
};

export default function CleanerPerformance() {
  const { data, isLoading } = useQuery({
    queryKey: ['cleaner-performance'],
    queryFn: async (): Promise<CleanerStats[]> => {
      const { data: members, error: mErr } = await supabase
        .from('team_members')
        .select('*')
        .eq('role', 'cleaner')
        .order('name');
      if (mErr) throw mErr;
      const cleaners = (members ?? []) as TeamMember[];
      if (cleaners.length === 0) return [];

      const ids = cleaners.map((c) => c.id);
      const { data: jobs } = await supabase
        .from('jobs')
        .select('assigned_to, status, completed_at, lead_id')
        .in('assigned_to', ids)
        .eq('status', 'completed');

      // Avg rating from feedback joined via lead_id -> we group by the cleaner that last completed the job for that lead.
      const leadIds = Array.from(new Set((jobs ?? []).map((j) => j.lead_id).filter(Boolean) as string[]));
      const { data: feedback } = leadIds.length
        ? await supabase.from('feedback').select('lead_id, rating').in('lead_id', leadIds)
        : { data: [] as { lead_id: string; rating: number }[] };

      const feedbackByLead = new Map<string, number[]>();
      (feedback ?? []).forEach((f) => {
        const arr = feedbackByLead.get(f.lead_id) ?? [];
        arr.push(f.rating);
        feedbackByLead.set(f.lead_id, arr);
      });

      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      return cleaners.map((m) => {
        const myJobs = (jobs ?? []).filter((j) => j.assigned_to === m.id);
        const total = myJobs.length;
        const thisMonth = myJobs.filter((j) => j.completed_at && new Date(j.completed_at) >= monthStart).length;
        const ratings: number[] = [];
        myJobs.forEach((j) => {
          const arr = feedbackByLead.get(j.lead_id);
          if (arr) ratings.push(...arr);
        });
        const avg = ratings.length ? ratings.reduce((s, r) => s + r, 0) / ratings.length : null;
        return { member: m, total, thisMonth, avgRating: avg };
      });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Cleaner Performance</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !data || data.length === 0 ? (
          <p className="text-sm text-muted-foreground">No cleaners on the team yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cleaner</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Total Jobs</TableHead>
                  <TableHead className="text-right">This Month</TableHead>
                  <TableHead className="text-right">Avg Rating</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((s) => (
                  <TableRow key={s.member.id}>
                    <TableCell className="font-medium">{s.member.name}</TableCell>
                    <TableCell>
                      {s.member.cleaner_type ? (
                        <Badge variant="secondary">{CLEANER_TYPE_LABELS[s.member.cleaner_type]}</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{s.total || '—'}</TableCell>
                    <TableCell className="text-right">{s.thisMonth || '—'}</TableCell>
                    <TableCell className="text-right">
                      {s.avgRating != null ? s.avgRating.toFixed(1) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
