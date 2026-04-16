import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { LeadSource, LeadStage, STAGE_LABELS } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Legend,
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

const STAGE_FILL: Record<LeadStage, string> = {
  new_lead: '#3b82f6',
  contacted: '#eab308',
  quote_sent: '#f59e0b',
  not_responding: '#f97316',
  booked: '#22c55e',
  not_interested: '#ef4444',
};

const STAGE_ORDER: LeadStage[] = [
  'new_lead', 'contacted', 'quote_sent', 'not_responding', 'booked', 'not_interested',
];

interface SourceRow {
  source: string;
  sourceKey: LeadSource;
  total: number;
  booked: number;
  contacted: number;
  quote_sent: number;
  conversion: number;
  // stage counts spread for stacked bar
  new_lead: number;
  not_responding: number;
  not_interested: number;
}

export default function SourceConversion() {
  const { data = [], isLoading } = useQuery({
    queryKey: ['source-conversion'],
    queryFn: async (): Promise<SourceRow[]> => {
      const { data, error } = await supabase
        .from('leads')
        .select('source, stage')
        .eq('is_archived', false);
      if (error) throw error;

      const map = new Map<LeadSource, Record<LeadStage, number>>();
      (data ?? []).forEach((r: { source: LeadSource; stage: LeadStage }) => {
        if (!map.has(r.source)) {
          map.set(r.source, {
            new_lead: 0, contacted: 0, quote_sent: 0,
            not_responding: 0, booked: 0, not_interested: 0,
          });
        }
        const row = map.get(r.source)!;
        row[r.stage] = (row[r.stage] ?? 0) + 1;
      });

      const rows: SourceRow[] = Array.from(map.entries())
        .map(([source, stages]) => {
          const total = STAGE_ORDER.reduce((sum, s) => sum + (stages[s] ?? 0), 0);
          return {
            sourceKey: source,
            source: SOURCE_LABELS[source] ?? source,
            total,
            booked: stages.booked,
            contacted: stages.contacted,
            quote_sent: stages.quote_sent,
            new_lead: stages.new_lead,
            not_responding: stages.not_responding,
            not_interested: stages.not_interested,
            conversion: total > 0 ? (stages.booked / total) * 100 : 0,
          };
        })
        .filter((r) => r.total > 0)
        .sort((a, b) => b.conversion - a.conversion);

      return rows;
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Source Conversion</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : data.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No leads yet.</p>
        ) : (
          <>
            {/* Per-source headline rows with stacked progress bars */}
            <div className="space-y-4">
              {data.map((row) => {
                const contactedPct = row.total ? ((row.contacted + row.quote_sent + row.booked + row.not_responding + row.not_interested) / row.total) * 100 : 0;
                const quotePct = row.total ? ((row.quote_sent + row.booked) / row.total) * 100 : 0;
                const bookedPct = row.total ? (row.booked / row.total) * 100 : 0;

                return (
                  <div key={row.sourceKey} className="space-y-2">
                    <div className="flex items-end justify-between gap-4">
                      <div>
                        <p className="font-semibold">{row.source}</p>
                        <p className="text-xs text-muted-foreground">{row.total} leads</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-green-600">{row.booked} booked</p>
                        <p className="text-xs text-muted-foreground">
                          {row.conversion.toFixed(1)}% conversion
                        </p>
                      </div>
                    </div>

                    {/* Stacked segment bar */}
                    <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
                      {STAGE_ORDER.map((stage) => {
                        const count = row[stage] as number;
                        if (!count) return null;
                        const pct = (count / row.total) * 100;
                        return (
                          <div
                            key={stage}
                            style={{ width: `${pct}%`, backgroundColor: STAGE_FILL[stage] }}
                            title={`${STAGE_LABELS[stage]}: ${count} (${pct.toFixed(1)}%)`}
                          />
                        );
                      })}
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>Contacted {contactedPct.toFixed(0)}%</span>
                      <span>Quote Sent {quotePct.toFixed(0)}%</span>
                      <span className="font-medium text-green-600">Booked {bookedPct.toFixed(0)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Stacked Recharts bar overview */}
            <div className="pt-2">
              <ResponsiveContainer width="100%" height={Math.max(200, data.length * 48)}>
                <BarChart
                  data={data}
                  layout="vertical"
                  margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
                  stackOffset="expand"
                >
                  <CartesianGrid horizontal={false} stroke="hsl(var(--border))" />
                  <XAxis
                    type="number"
                    tickFormatter={(v) => `${Math.round(v * 100)}%`}
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                  />
                  <YAxis
                    type="category"
                    dataKey="source"
                    width={90}
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    formatter={(val: number, name: string) => [val, STAGE_LABELS[name as LeadStage] ?? name]}
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Legend
                    formatter={(value) => STAGE_LABELS[value as LeadStage] ?? value}
                    wrapperStyle={{ fontSize: 12 }}
                  />
                  {STAGE_ORDER.map((stage) => (
                    <Bar
                      key={stage}
                      dataKey={stage}
                      stackId="stages"
                      fill={STAGE_FILL[stage]}
                      barSize={22}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Summary table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Source</th>
                    <th className="py-2 pr-4 font-medium">Total Leads</th>
                    <th className="py-2 pr-4 font-medium">Booked</th>
                    <th className="py-2 pr-4 font-medium">Conversion Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((row) => (
                    <tr key={row.sourceKey} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-medium">{row.source}</td>
                      <td className="py-2 pr-4">{row.total}</td>
                      <td className="py-2 pr-4">{row.booked}</td>
                      <td className="py-2 pr-4 font-semibold text-green-600">
                        {row.conversion.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
