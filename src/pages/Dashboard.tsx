import { useAuth } from '@/contexts/AuthContext';
import KPICards from '@/components/dashboard/KPICards';
import KanbanBoard from '@/components/dashboard/KanbanBoard';

export default function Dashboard() {
  const { role } = useAuth();
  const showKPIs = role === 'owner' || role === 'admin' || role === 'manager';

  return (
    <div>
      {showKPIs && <KPICards />}
      <div>
        <h2 className="text-lg font-semibold mb-3">Lead Pipeline</h2>
        <KanbanBoard />
      </div>
    </div>
  );
}
