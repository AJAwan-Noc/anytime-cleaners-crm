import { useAuth } from '@/contexts/AuthContext';
import KPICards from '@/components/dashboard/KPICards';
import KanbanBoard from '@/components/dashboard/KanbanBoard';
import LeadSourcesChart from '@/components/dashboard/LeadSourcesChart';
import SourceConversion from '@/components/dashboard/SourceConversion';
import RecentReviews from '@/components/dashboard/RecentReviews';

export default function Dashboard() {
  const { role } = useAuth();
  const showAnalytics = role === 'owner' || role === 'admin' || role === 'manager';

  return (
    <div className="space-y-6">
      {showAnalytics && <KPICards />}
      {showAnalytics && <LeadSourcesChart />}
      {showAnalytics && <SourceConversion />}
      {showAnalytics && <RecentReviews />}
      <div>
        <h2 className="text-lg font-semibold mb-3">Lead Pipeline</h2>
        <KanbanBoard />
      </div>
    </div>
  );
}
