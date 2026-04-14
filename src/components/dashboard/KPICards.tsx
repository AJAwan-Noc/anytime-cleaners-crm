import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Users, UserPlus, CalendarCheck, DollarSign } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface KPI {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
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

      const [totalRes, todayRes, bookedRes, revenueRes] = await Promise.all([
        supabase.from('leads').select('id', { count: 'exact', head: true }).eq('is_archived', false),
        supabase.from('leads').select('id', { count: 'exact', head: true }).gte('created_at', todayStart),
        supabase.from('leads').select('id', { count: 'exact', head: true }).eq('stage', 'booked').gte('created_at', weekStart.toISOString()),
        supabase.from('invoices').select('total').eq('status', 'paid').gte('created_at', new Date(now.getFullYear(), now.getMonth(), 1).toISOString()),
      ]);

      const revenue = (revenueRes.data ?? []).reduce((sum, inv) => sum + (inv.total ?? 0), 0);

      return [
        { label: 'Total Leads', value: totalRes.count ?? 0, icon: <Users className="h-5 w-5" />, color: 'text-blue-600' },
        { label: 'Leads Today', value: todayRes.count ?? 0, icon: <UserPlus className="h-5 w-5" />, color: 'text-indigo-600' },
        { label: 'Booked This Week', value: bookedRes.count ?? 0, icon: <CalendarCheck className="h-5 w-5" />, color: 'text-green-600' },
        { label: 'Revenue This Month', value: `$${revenue.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`, icon: <DollarSign className="h-5 w-5" />, color: 'text-emerald-600' },
      ];
    },
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i}><CardContent className="p-5"><Skeleton className="h-16 w-full" /></CardContent></Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {kpis?.map((kpi) => (
        <Card key={kpi.label} className="hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{kpi.label}</p>
                <p className="text-2xl font-bold mt-1">{kpi.value}</p>
              </div>
              <div className={`p-3 rounded-full bg-muted ${kpi.color}`}>{kpi.icon}</div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
