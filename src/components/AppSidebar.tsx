import {
  LayoutDashboard,
  Users,
  UserCog,
  FileText,
  Settings,
  Mail,
  Kanban,
  Building2,
  Calendar as CalendarIcon,
  Activity,
  User as UserIcon,
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/contexts/AuthContext';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { Role } from '@/types';
import logo from '@/assets/logo.png';

interface NavItem {
  title: string;
  url: string;
  icon: React.ElementType;
  roles: Role[];
}

const navItems: NavItem[] = [
  { title: 'Dashboard', url: '/', icon: LayoutDashboard, roles: ['owner', 'admin', 'manager', 'agent'] },
  { title: 'Calendar', url: '/calendar', icon: CalendarIcon, roles: ['owner', 'admin', 'manager', 'agent', 'cleaner'] },
  { title: 'Pipeline', url: '/pipeline', icon: Kanban, roles: ['owner', 'admin', 'manager', 'agent'] },
  { title: 'Leads', url: '/leads', icon: Users, roles: ['owner', 'admin', 'manager', 'agent'] },
  { title: 'Properties', url: '/properties', icon: Building2, roles: ['owner', 'admin', 'manager'] },
  { title: 'Team', url: '/team', icon: UserCog, roles: ['owner', 'admin', 'manager'] },
  { title: 'Invoices', url: '/invoices', icon: FileText, roles: ['owner', 'admin', 'manager'] },
  { title: 'Activity', url: '/activity', icon: Activity, roles: ['owner', 'admin', 'manager'] },
  { title: 'Profile', url: '/profile', icon: UserIcon, roles: ['owner', 'admin', 'manager', 'agent', 'cleaner'] },
  { title: 'Admin', url: '/admin', icon: Settings, roles: ['owner', 'admin'] },
  { title: 'Email Templates', url: '/admin/email-templates', icon: Mail, roles: ['owner', 'admin'] },
];

export function AppSidebar() {
  const { role } = useAuth();
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';

  const filteredItems = navItems.filter((item) => role && item.roles.includes(role));

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarContent className="bg-sidebar relative overflow-hidden">
        {/* Decorative glow */}
        <div className="pointer-events-none absolute -top-24 -left-24 h-64 w-64 rounded-full bg-accent/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-24 h-64 w-64 rounded-full bg-primary/15 blur-3xl" />

        <div className={`relative px-3 py-5 flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
          <div className="relative shrink-0">
            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-accent to-primary blur-md opacity-60 animate-pulse-glow" />
            <img
              src={logo}
              alt="Anytime Cleaners"
              className="relative h-10 w-10 object-contain rounded-lg"
            />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight animate-fade-in">
              <span className="text-sm font-bold text-sidebar-primary-foreground tracking-tight">
                Anytime
              </span>
              <span className="text-sm font-bold text-primary tracking-tight">
                Cleaners
              </span>
            </div>
          )}
        </div>

        <SidebarGroup className="relative">
          <SidebarGroupContent>
            <SidebarMenu className="gap-1 px-2">
              {filteredItems.map((item, idx) => (
                <SidebarMenuItem
                  key={item.title}
                  className="animate-slide-in-left"
                  style={{ animationDelay: `${idx * 30}ms`, animationFillMode: 'backwards' }}
                >
                  <SidebarMenuButton asChild className="h-10 rounded-lg group transition-all duration-200">
                    <NavLink
                      to={item.url}
                      end={item.url === '/'}
                      className="hover:bg-sidebar-accent/60 hover:text-primary"
                      activeClassName="!bg-sidebar-accent !text-primary font-semibold relative before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-6 before:w-1 before:rounded-r-full before:bg-primary before:shadow-[0_0_12px_hsl(var(--primary))]"
                    >
                      <item.icon className="h-4 w-4 mr-2 shrink-0 transition-transform group-hover:scale-110" />
                      {!collapsed && <span className="text-sm">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
