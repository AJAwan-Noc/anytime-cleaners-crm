import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { LeadSource } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, LabelList, Tooltip, CartesianGrid,
} from 'recharts';

const SOURCE_LABELS: Record<LeadSource, string> = {
  website: 'Website',
  facebook: 'Facebook',
  instagram: 'Instagram',
  referral: 'Referral',
  google: 'Google',
  manual: 'Manual',
  other: 'Other',
};

export default function LeadSourcesChart() {
  const { data = [], isLoading } = useQuery({
    queryKey: ['lead-sources-chart'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('source')
        .eq('is_archived', false);
      if (error) throw error;

      const counts = new Map<LeadSource, number>();
      (data ?? []).forEach((row: { source: LeadSource }) => {
        counts.set(row.source, (counts.get(row.source) ?? 0) + 1);
      });

      return Array.from(counts.entries())
        .filter(([, count]) => count > 0)
        .map(([source, count]) => ({
          source: SOURCE_LABELS[source] ?? source,
          count,
        }))
        .sort((a, b) => b.count - a.count);
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Lead Sources</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : data.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No leads yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(180, data.length * 44)}>
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 8, right: 32, left: 8, bottom: 8 }}
            >
              <CartesianGrid horizontal={false} stroke="hsl(var(--border))" />
              <XAxis type="number" allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis
                type="category"
                dataKey="source"
                width={100}
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                cursor={{ fill: 'hsl(var(--muted) / 0.4)' }}
                contentStyle={{
                  background: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} barSize={22}>
                <LabelList
                  dataKey="count"
                  position="right"
                  style={{ fill: 'hsl(var(--foreground))', fontSize: 12, fontWeight: 600 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
