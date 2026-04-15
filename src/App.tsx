import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import AppLayout from '@/components/AppLayout';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import Leads from '@/pages/Leads';
import LeadDetailPage from '@/pages/LeadDetailPage';
import NewLeadPage from '@/pages/NewLeadPage';
import Team from '@/pages/Team';
import Invoices from '@/pages/Invoices';
import InvoiceDetailPage from '@/pages/InvoiceDetailPage';
import AdminSettings from '@/pages/AdminSettings';
import NotFound from '@/pages/NotFound';


const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<Dashboard />} />
              <Route path="/leads" element={<Leads />} />
              <Route path="/leads/new" element={<NewLeadPage />} />
              <Route path="/leads/:id" element={<LeadDetailPage />} />
              <Route
                path="/team"
                element={
                  <ProtectedRoute allowedRoles={['owner', 'admin', 'manager']}>
                    <Team />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/invoices"
                element={
                  <ProtectedRoute allowedRoles={['owner', 'admin', 'manager']}>
                    <Invoices />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/invoices/:id"
                element={
                  <ProtectedRoute allowedRoles={['owner', 'admin', 'manager']}>
                    <Invoices />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin"
                element={
                  <ProtectedRoute allowedRoles={['owner', 'admin']}>
                    <AdminSettings />
                  </ProtectedRoute>
                }
              />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
