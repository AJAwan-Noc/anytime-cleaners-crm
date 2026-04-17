import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { TeamMember, STAGE_LABELS, LeadStage } from '@/types';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';

interface Props {
  member: TeamMember | null;
  onClose: () => void;
}

export default function MemberStatsDialog({ member, onClose }: Props) {
  const open = !!member;
  const id = member?.id;
  const role = member?.role;

  const { data, isLoading } = useQuery({
    queryKey: ['member-stats', id],
    enabled: open && !!id,
    queryFn: async () => {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const { data: jobs } = await supabase
        .from('jobs')
        .select('status, completed_at, lead_id')
        .eq('assigned_to', id!);

      const completed = (jobs ?? []).filter((j) => j.status === 'completed');
      const total = completed.length;
      const thisMonth = completed.filter((j) => j.completed_at && new Date(j.completed_at) >= monthStart).length;

      // Avg rating across leads this member is/was assigned to
      const { data: leads } = await supabase
        .from('leads')
        .select('id, stage')
        .eq('assigned_to', id!);
      const leadIds = (leads ?? []).map((l) => l.id);
      const { data: feedback } = leadIds.length
        ? await supabase.from('feedback').select('rating').in('lead_id', leadIds)
        : { data: [] as { rating: number }[] };
      const ratings = (feedback ?? []).map((f) => f.rating);
      const avgRating = ratings.length ? ratings.reduce((s, r) => s + r, 0) / ratings.length : null;

      // Stage breakdown for agents
      const stageCounts: Record<string, number> = {};
      if (role === 'agent') {
        (leads ?? []).forEach((l) => {
          stageCounts[l.stage] = (stageCounts[l.stage] || 0) + 1;
        });
      }
      const stageData = Object.entries(stageCounts).map(([stage, count]) => ({
        stage: STAGE_LABELS[stage as LeadStage] ?? stage,
        count,
      }));

      return { total, thisMonth, avgRating, stageData };
    },
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{member?.name} — Stats</DialogTitle>
        </DialogHeader>
        {isLoading || !data ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Completed Jobs" value={data.total || '—'} />
              <Stat label="This Month" value={data.thisMonth || '—'} />
              <Stat label="Avg Rating" value={data.avgRating != null ? data.avgRating.toFixed(1) : '—'} />
            </div>

            {role === 'agent' && (
              <Card className="p-3">
                <h3 className="text-sm font-semibold mb-2">Lead Stage Breakdown</h3>
                {data.stageData.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No data yet</p>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={data.stageData}>
                      <XAxis dataKey="stage" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </Card>
            )}

            {data.total === 0 && data.avgRating == null && role !== 'agent' && (
              <p className="text-sm text-muted-foreground text-center">No data yet</p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}
