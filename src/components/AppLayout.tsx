import { Outlet, useLocation } from 'react-router-dom';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { TopBar } from '@/components/TopBar';

export default function AppLayout() {
  const location = useLocation();
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar />
          <main className="flex-1 overflow-auto p-3 sm:p-4 md:p-6 min-w-0 relative">
            {/* Subtle ambient background */}
            <div className="pointer-events-none fixed inset-0 -z-10 opacity-50 bg-glow" />
            <div key={location.pathname} className="animate-fade-in">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
