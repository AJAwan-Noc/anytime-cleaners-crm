import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import StarRating from '@/components/feedback/StarRating';
import { format } from 'date-fns';

interface ReviewRow {
  id: string;
  average_rating: number | null;
  review_text: string | null;
  submitted_at: string | null;
  lead: { full_name: string } | null;
}

export default function RecentReviews() {
  const { data = [], isLoading } = useQuery({
    queryKey: ['recent-reviews'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('feedback')
        .select('id, average_rating, review_text, submitted_at, lead:leads(full_name)')
        .eq('submitted', true)
        .order('submitted_at', { ascending: false })
        .limit(3);
      if (error) throw error;
      return (data ?? []) as unknown as ReviewRow[];
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Reviews</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && data.length === 0 && (
          <p className="text-sm text-muted-foreground">No reviews yet.</p>
        )}
        <div className="space-y-4">
          {data.map((r) => (
            <div key={r.id} className="border-b pb-3 last:border-0 last:pb-0 space-y-1.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="font-medium text-sm">{r.lead?.full_name ?? 'Unknown'}</span>
                <div className="flex items-center gap-2">
                  <StarRating value={Math.round(r.average_rating ?? 0)} readonly size="sm" />
                  <span className="text-xs text-muted-foreground">
                    {r.average_rating?.toFixed(1)}
                  </span>
                </div>
              </div>
              {r.review_text && (
                <p className="text-sm text-muted-foreground line-clamp-2 italic">
                  "{r.review_text}"
                </p>
              )}
              {r.submitted_at && (
                <p className="text-xs text-muted-foreground">
                  {format(new Date(r.submitted_at), 'PP')}
                </p>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
