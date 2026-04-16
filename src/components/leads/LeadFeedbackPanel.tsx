import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import StarRating from '@/components/feedback/StarRating';

interface FeedbackRow {
  id: string;
  lead_id: string;
  submitted: boolean;
  submitted_at: string | null;
  sent_at: string | null;
  overall_satisfaction: number | null;
  cleaning_quality: number | null;
  punctuality: number | null;
  value_for_money: number | null;
  would_recommend: 'yes' | 'no' | 'maybe' | null;
  review_text: string | null;
  average_rating: number | null;
}

const RECOMMEND_BADGE: Record<string, string> = {
  yes: 'bg-green-100 text-green-800',
  no: 'bg-red-100 text-red-800',
  maybe: 'bg-amber-100 text-amber-800',
};

export default function LeadFeedbackPanel({ leadId }: { leadId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['lead-feedback', leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('feedback')
        .select('*')
        .eq('lead_id', leadId)
        .maybeSingle();
      if (error) throw error;
      return data as FeedbackRow | null;
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Customer Feedback</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

        {!isLoading && !data && (
          <p className="text-sm text-muted-foreground">Feedback not yet requested.</p>
        )}

        {!isLoading && data && !data.submitted && (
          <div className="text-sm space-y-1">
            <p className="text-muted-foreground">Feedback requested — awaiting response</p>
            {data.sent_at && (
              <p className="text-xs text-muted-foreground">
                Sent {format(new Date(data.sent_at), 'PP')}
              </p>
            )}
          </div>
        )}

        {!isLoading && data?.submitted && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <StarRating value={Math.round(data.average_rating ?? 0)} readonly size="md" />
              <span className="text-lg font-semibold">
                {data.average_rating?.toFixed(1) ?? '0.0'}/5
              </span>
            </div>

            <div className="space-y-2 text-sm">
              <CategoryRow label="Overall" value={data.overall_satisfaction} />
              <CategoryRow label="Cleaning" value={data.cleaning_quality} />
              <CategoryRow label="Punctuality" value={data.punctuality} />
              <CategoryRow label="Value" value={data.value_for_money} />
            </div>

            {data.would_recommend && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Recommends:</span>
                <Badge className={RECOMMEND_BADGE[data.would_recommend]} variant="secondary">
                  {data.would_recommend.charAt(0).toUpperCase() + data.would_recommend.slice(1)}
                </Badge>
              </div>
            )}

            {data.review_text && (
              <blockquote className="bg-muted rounded-md p-3 text-sm italic border-l-2 border-indigo-500">
                "{data.review_text}"
              </blockquote>
            )}

            {data.submitted_at && (
              <p className="text-xs text-muted-foreground">
                Submitted {format(new Date(data.submitted_at), 'PPp')}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CategoryRow({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <StarRating value={value ?? 0} readonly size="sm" />
    </div>
  );
}
