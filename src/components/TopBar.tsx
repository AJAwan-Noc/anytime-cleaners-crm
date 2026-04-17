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
  '/calendar': 'Calendar',
  '/pipeline': 'Pipeline',
  '/leads': 'Leads',
  '/leads/new': 'New Lead',
  '/properties': 'Properties',
  '/team': 'Team',
  '/invoices': 'Invoices',
  '/activity': 'Activity',
  '/profile': 'Profile',
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

  const roleBadgeClass =
    role === 'owner'
      ? 'bg-gradient-to-r from-accent to-primary text-primary-foreground border-0'
      : role === 'admin'
        ? 'bg-primary text-primary-foreground border-0'
        : role === 'manager'
          ? 'bg-accent/15 text-accent border-accent/30'
          : role === 'cleaner'
            ? 'bg-primary/15 text-primary border-primary/30'
            : 'bg-muted text-muted-foreground';

  const initials = teamMember?.name
    ?.split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() ?? '?';

  return (
    <header className="h-16 border-b border-border/60 glass flex items-center justify-between gap-2 px-3 sm:px-5 shrink-0 min-w-0 sticky top-0 z-30">
      <div className="flex items-center gap-3 min-w-0">
        <SidebarTrigger className="text-muted-foreground hover:text-primary transition-colors shrink-0" />
        <div className="min-w-0">
          <h1 className="text-base sm:text-lg font-bold truncate leading-tight">{pageTitle}</h1>
          <p className="text-[11px] text-muted-foreground hidden sm:block leading-tight">
            We clean it, we mean it
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4 shrink-0">
        <button className="relative p-2 rounded-lg hover:bg-muted transition-colors group">
          <Bell className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
          {notRespondingCount > 0 && (
            <span className="absolute top-0.5 right-0.5 h-4 min-w-4 rounded-full bg-gradient-to-br from-orange-500 to-red-500 text-[10px] font-bold text-white flex items-center justify-center px-1 shadow-md animate-pulse">
              {notRespondingCount}
            </span>
          )}
        </button>

        {teamMember && (
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative shrink-0">
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-accent to-primary flex items-center justify-center text-xs font-bold text-primary-foreground shadow-md">
                {initials}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-green-500 border-2 border-background" />
            </div>
            <div className="hidden md:flex flex-col leading-tight min-w-0">
              <span className="text-sm font-semibold truncate max-w-[140px]">{teamMember.name}</span>
              <Badge className={`text-[9px] uppercase tracking-wider px-1.5 py-0 h-4 w-fit ${roleBadgeClass}`}>
                {role}
              </Badge>
            </div>
          </div>
        )}

        <Button
          variant="ghost"
          size="icon"
          onClick={signOut}
          title="Sign out"
          className="hover:bg-destructive/10 hover:text-destructive transition-colors"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
