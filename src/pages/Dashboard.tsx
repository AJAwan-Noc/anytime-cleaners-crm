import { useAuth } from '@/contexts/AuthContext';

export default function Dashboard() {
  const { teamMember, role } = useAuth();

  return (
    <div>
      <p className="text-muted-foreground">
        Welcome back, {teamMember?.name ?? 'User'}. Dashboard coming in Phase 2.
      </p>
      {role && (
        <p className="text-sm text-muted-foreground mt-1">
          Role: <span className="font-medium capitalize">{role}</span>
        </p>
      )}
    </div>
  );
}
