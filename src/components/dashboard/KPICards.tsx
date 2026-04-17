import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Users, UserPlus, CalendarCheck, DollarSign, Star } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface KPI {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  gradient: string;
  iconColor: string;
}

export default function KPICards() {
  const { data: kpis, isLoading } = useQuery({
    queryKey: ['dashboard-kpis'],
    queryFn: async (): Promise<KPI[]> => {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      weekStart.setHours(0, 0, 0, 0);

      const [totalRes, todayRes, bookedRes, revenueRes, ratingsRes] = await Promise.all([
        supabase.from('leads').select('id', { count: 'exact', head: true }).eq('is_archived', false),
        supabase.from('leads').select('id', { count: 'exact', head: true }).gte('created_at', todayStart),
        supabase.from('leads').select('id', { count: 'exact', head: true }).eq('stage', 'booked').gte('created_at', weekStart.toISOString()),
        supabase.from('invoices').select('total').eq('status', 'paid').gte('created_at', new Date(now.getFullYear(), now.getMonth(), 1).toISOString()),
        supabase.from('feedback').select('average_rating').eq('submitted', true),
      ]);

      const revenue = (revenueRes.data ?? []).reduce((sum, inv) => sum + (inv.total ?? 0), 0);
      const ratings = (ratingsRes.data ?? []).map((r: { average_rating: number | null }) => r.average_rating ?? 0).filter((n) => n > 0);
      const avgRating = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;

      return [
        { label: 'Total Leads', value: totalRes.count ?? 0, icon: <Users className="h-5 w-5" />, gradient: 'from-accent/20 to-accent/5', iconColor: 'text-accent' },
        { label: 'Leads Today', value: todayRes.count ?? 0, icon: <UserPlus className="h-5 w-5" />, gradient: 'from-primary/20 to-primary/5', iconColor: 'text-primary' },
        { label: 'Booked This Week', value: bookedRes.count ?? 0, icon: <CalendarCheck className="h-5 w-5" />, gradient: 'from-green-400/20 to-green-400/5', iconColor: 'text-green-600' },
        { label: 'Revenue This Month', value: `$${revenue.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`, icon: <DollarSign className="h-5 w-5" />, gradient: 'from-emerald-400/20 to-emerald-400/5', iconColor: 'text-emerald-600' },
        { label: 'Avg Rating', value: avgRating !== null ? `${avgRating.toFixed(1)}/5` : '—', icon: <Star className="h-5 w-5" />, gradient: 'from-amber-400/20 to-amber-400/5', iconColor: 'text-amber-500' },
      ];
    },
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {[...Array(5)].map((_, i) => (
          <Card key={i}><CardContent className="p-5"><Skeleton className="h-16 w-full" /></CardContent></Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
      {kpis?.map((kpi, idx) => (
        <Card
          key={kpi.label}
          className="relative overflow-hidden border-border/60 shadow-card hover-lift animate-fade-in-up group"
          style={{ animationDelay: `${idx * 60}ms`, animationFillMode: 'backwards' }}
        >
          <div className={`absolute inset-0 bg-gradient-to-br ${kpi.gradient} opacity-50 group-hover:opacity-100 transition-opacity`} />
          <CardContent className="relative p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{kpi.label}</p>
                <p className="text-2xl font-bold mt-1.5 tracking-tight">{kpi.value}</p>
              </div>
              <div className={`p-2.5 rounded-xl bg-background/80 backdrop-blur ${kpi.iconColor} shadow-sm group-hover:scale-110 transition-transform`}>
                {kpi.icon}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
