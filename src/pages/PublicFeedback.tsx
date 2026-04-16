import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, CheckCircle2, Sparkles } from 'lucide-react';
import StarRating from '@/components/feedback/StarRating';
import { cn } from '@/lib/utils';

interface FeedbackRow {
  id: string;
  lead_id: string;
  token: string;
  submitted: boolean;
  lead?: { full_name: string } | null;
}

type Recommend = 'yes' | 'no' | 'maybe';

export default function PublicFeedback() {
  const [params] = useSearchParams();
  const token = params.get('token');

  const [loading, setLoading] = useState(true);
  const [row, setRow] = useState<FeedbackRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [overall, setOverall] = useState(0);
  const [cleaning, setCleaning] = useState(0);
  const [punctuality, setPunctuality] = useState(0);
  const [value, setValue] = useState(0);
  const [recommend, setRecommend] = useState<Recommend | null>(null);
  const [review, setReview] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    (async () => {
      if (!token) {
        setError('Missing feedback token.');
        setLoading(false);
        return;
      }
      const { data, error: err } = await supabase
        .from('feedback')
        .select('id, lead_id, token, submitted, lead:leads(full_name)')
        .eq('token', token)
        .maybeSingle();
      if (err || !data) {
        setError('This feedback link is invalid or expired.');
      } else {
        setRow(data as unknown as FeedbackRow);
      }
      setLoading(false);
    })();
  }, [token]);

  const canSubmit = overall && cleaning && punctuality && value && recommend;

  const handleSubmit = async () => {
    if (!row || !canSubmit) return;
    setSubmitting(true);
    const average = (overall + cleaning + punctuality + value) / 4;
    const { error: err } = await supabase
      .from('feedback')
      .update({
        overall_satisfaction: overall,
        cleaning_quality: cleaning,
        punctuality,
        value_for_money: value,
        would_recommend: recommend,
        review_text: review.trim() || null,
        submitted: true,
        submitted_at: new Date().toISOString(),
        average_rating: Number(average.toFixed(2)),
      })
      .eq('token', row.token);
    setSubmitting(false);
    if (err) {
      setError('Failed to submit feedback. Please try again.');
      return;
    }
    setSubmitted(true);
  };

  const fullName = row?.lead?.full_name ?? '';
  const firstName = fullName.split(' ')[0] || 'there';

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-background to-indigo-100/40">
      <div className="max-w-xl mx-auto px-4 py-8 sm:py-12">
        {/* Brand header */}
        <div className="flex items-center gap-2 mb-8 justify-center">
          <div className="h-9 w-9 rounded-lg bg-indigo-600 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight">Anytime Cleaners</span>
        </div>

        {loading && (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          </div>
        )}

        {!loading && error && !row && (
          <div className="bg-card border rounded-2xl p-8 text-center shadow-sm">
            <p className="text-muted-foreground">{error}</p>
          </div>
        )}

        {!loading && row && (row.submitted || submitted) && (
          <div className="bg-card border rounded-2xl p-10 text-center shadow-sm space-y-4">
            <div className="mx-auto h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="h-9 w-9 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold">
              {submitted ? 'Thank you for your feedback!' : 'Thank you'}
            </h1>
            <p className="text-muted-foreground">
              {submitted
                ? 'We really appreciate you taking the time to share your experience.'
                : 'Your feedback has already been recorded.'}
            </p>
          </div>
        )}

        {!loading && row && !row.submitted && !submitted && (
          <div className="bg-card border rounded-2xl shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-600 to-indigo-500 text-white px-6 py-6">
              <h1 className="text-xl sm:text-2xl font-bold">
                Hi {firstName}, how was your experience?
              </h1>
              <p className="text-indigo-100 text-sm mt-1">
                Your feedback helps us serve you better.
              </p>
            </div>

            <div className="p-6 space-y-7">
              <Question label="Overall satisfaction">
                <StarRating value={overall} onChange={setOverall} size="lg" />
              </Question>

              <Question label="Quality of cleaning">
                <StarRating value={cleaning} onChange={setCleaning} size="lg" />
              </Question>

              <Question label="Punctuality of the team">
                <StarRating value={punctuality} onChange={setPunctuality} size="lg" />
              </Question>

              <Question label="Value for money">
                <StarRating value={value} onChange={setValue} size="lg" />
              </Question>

              <Question label="Would you recommend us?">
                <div className="flex gap-2 flex-wrap">
                  {(['yes', 'no', 'maybe'] as Recommend[]).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setRecommend(opt)}
                      className={cn(
                        'px-5 py-2.5 rounded-lg border text-sm font-medium capitalize transition-colors',
                        recommend === opt
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-background hover:bg-muted border-input',
                      )}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </Question>

              <Question label="Write a review (optional)">
                <Textarea
                  placeholder="Tell us about your experience..."
                  value={review}
                  onChange={(e) => setReview(e.target.value)}
                  rows={4}
                />
              </Question>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button
                onClick={handleSubmit}
                disabled={!canSubmit || submitting}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white h-12 text-base"
              >
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Submit Feedback
              </Button>
            </div>
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground mt-6">
          © {new Date().getFullYear()} Anytime Cleaners
        </p>
      </div>
    </div>
  );
}

function Question({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-semibold text-foreground block">{label}</label>
      {children}
    </div>
  );
}
