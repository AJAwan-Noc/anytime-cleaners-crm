import { useAuth } from '@/contexts/AuthContext';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, LogOut } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useLocation } from 'react-router-dom';

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/leads': 'Leads',
  '/leads/new': 'New Lead',
  '/team': 'Team',
  '/invoices': 'Invoices',
  '/admin': 'Admin Settings',
};

export function TopBar() {
  const { teamMember, role, signOut } = useAuth();
  const location = useLocation();

  const pageTitle =
    PAGE_TITLES[location.pathname] ||
    (location.pathname.startsWith('/leads/') ? 'Lead Detail' :
     location.pathname.startsWith('/invoices/') ? 'Invoice Detail' : 'CRM');

  const { data: notRespondingCount = 0 } = useQuery({
    queryKey: ['not-responding-count'],
    queryFn: async () => {
      const { count } = await supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('stage', 'not_responding')
        .eq('is_archived', false);
      return count ?? 0;
    },
    refetchInterval: 30000,
  });

  const roleBadgeColor =
    role === 'owner'
      ? 'bg-purple-100 text-purple-800'
      : role === 'admin'
        ? 'bg-primary text-primary-foreground'
        : role === 'manager'
          ? 'bg-blue-100 text-blue-800'
          : 'bg-gray-100 text-gray-800';

  return (
    <header className="h-14 border-b bg-card flex items-center justify-between gap-2 px-2 sm:px-4 shrink-0 min-w-0">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <SidebarTrigger className="text-muted-foreground shrink-0" />
        <h1 className="text-base sm:text-lg font-semibold truncate">{pageTitle}</h1>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <div className="relative">
          <Bell className="h-5 w-5 text-muted-foreground" />
          {notRespondingCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 h-4 min-w-4 rounded-full bg-orange-500 text-[10px] font-bold text-white flex items-center justify-center px-1">
              {notRespondingCount}
            </span>
          )}
        </div>

        {teamMember && (
          <div className="flex items-center gap-2 text-sm min-w-0">
            <span className="font-medium hidden md:inline truncate max-w-[160px]">{teamMember.name}</span>
            <Badge className={`text-[10px] uppercase tracking-wider ${roleBadgeColor}`}>
              {role}
            </Badge>
          </div>
        )}

        <Button variant="ghost" size="icon" onClick={signOut} title="Sign out">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
