import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import AppLayout from '@/components/AppLayout';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import Pipeline from '@/pages/Pipeline';
import Leads from '@/pages/Leads';
import LeadDetailPage from '@/pages/LeadDetailPage';
import NewLeadPage from '@/pages/NewLeadPage';
import Properties from '@/pages/Properties';
import PropertyDetailPage from '@/pages/PropertyDetailPage';
import Team from '@/pages/Team';
import Invoices from '@/pages/Invoices';
import InvoiceDetailPage from '@/pages/InvoiceDetailPage';
import NewInvoicePage from '@/pages/NewInvoicePage';
import AdminSettings from '@/pages/AdminSettings';
import EmailTemplates from '@/pages/EmailTemplates';
import EmailTemplateEditor from '@/pages/EmailTemplateEditor';
import PublicFeedback from '@/pages/PublicFeedback';
import CalendarPage from '@/pages/Calendar';
import ActivityPage from '@/pages/Activity';
import ClientPortal from '@/pages/ClientPortal';
import Profile from '@/pages/Profile';
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
            <Route path="/feedback" element={<PublicFeedback />} />
            <Route
              path="/portal"
              element={
                <ProtectedRoute allowedRoles={['client']}>
                  <ClientPortal />
                </ProtectedRoute>
              }
            />
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route
                path="/"
                element={
                  <ProtectedRoute allowedRoles={['owner', 'admin', 'manager', 'agent', 'cleaner']}>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/calendar"
                element={
                  <ProtectedRoute allowedRoles={['owner', 'admin', 'manager', 'agent', 'cleaner']}>
                    <CalendarPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/pipeline"
                element={
                  <ProtectedRoute allowedRoles={['owner', 'admin', 'manager', 'agent', 'cleaner']}>
                    <Pipeline />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/leads"
                element={
                  <ProtectedRoute allowedRoles={['owner', 'admin', 'manager', 'agent', 'cleaner']}>
                    <Leads />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/leads/new"
                element={
                  <ProtectedRoute allowedRoles={['owner', 'admin', 'manager', 'agent', 'cleaner']}>
                    <NewLeadPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/leads/:id"
                element={
                  <ProtectedRoute allowedRoles={['owner', 'admin', 'manager', 'agent', 'cleaner']}>
                    <LeadDetailPage />
                  </ProtectedRoute>
                }
              />
              <Route path="/profile" element={<Profile />} />
              <Route
                path="/properties"
                element={
                  <ProtectedRoute allowedRoles={['owner', 'admin', 'manager']}>
                    <Properties />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/properties/:id"
                element={
                  <ProtectedRoute allowedRoles={['owner', 'admin', 'manager']}>
                    <PropertyDetailPage />
                  </ProtectedRoute>
                }
              />
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
                path="/invoices/new"
                element={
                  <ProtectedRoute allowedRoles={['owner', 'admin', 'manager']}>
                    <NewInvoicePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/invoices/:id"
                element={
                  <ProtectedRoute allowedRoles={['owner', 'admin', 'manager']}>
                    <InvoiceDetailPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/activity"
                element={
                  <ProtectedRoute allowedRoles={['owner', 'admin', 'manager']}>
                    <ActivityPage />
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
              <Route
                path="/admin/email-templates"
                element={
                  <ProtectedRoute allowedRoles={['owner', 'admin']}>
                    <EmailTemplates />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/email-templates/:template_key"
                element={
                  <ProtectedRoute allowedRoles={['owner', 'admin']}>
                    <EmailTemplateEditor />
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
