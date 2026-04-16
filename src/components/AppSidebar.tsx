import {
  LayoutDashboard,
  Users,
  UserCog,
  FileText,
  Settings,
  Mail,
  Kanban,
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

interface NavItem {
  title: string;
  url: string;
  icon: React.ElementType;
  roles: Role[];
}

const navItems: NavItem[] = [
  { title: 'Dashboard', url: '/', icon: LayoutDashboard, roles: ['owner', 'admin', 'manager', 'agent'] },
  { title: 'Pipeline', url: '/pipeline', icon: Kanban, roles: ['owner', 'admin', 'manager', 'agent'] },
  { title: 'Leads', url: '/leads', icon: Users, roles: ['owner', 'admin', 'manager', 'agent'] },
  { title: 'Team', url: '/team', icon: UserCog, roles: ['owner', 'admin', 'manager'] },
  { title: 'Invoices', url: '/invoices', icon: FileText, roles: ['owner', 'admin', 'manager'] },
  { title: 'Admin', url: '/admin', icon: Settings, roles: ['owner', 'admin'] },
  { title: 'Email Templates', url: '/admin/email-templates', icon: Mail, roles: ['owner', 'admin'] },
];

export function AppSidebar() {
  const { role } = useAuth();
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';

  const filteredItems = navItems.filter((item) => role && item.roles.includes(role));

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className="px-4 py-5 flex items-center gap-2">
          {!collapsed && (
            <span className="text-lg font-bold text-sidebar-primary-foreground tracking-tight">
              Anytime Cleaners
            </span>
          )}
          {collapsed && (
            <span className="text-lg font-bold text-sidebar-primary-foreground">AC</span>
          )}
        </div>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === '/'}
                      className="hover:bg-sidebar-accent/50"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    >
                      <item.icon className="h-4 w-4 mr-2 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
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
