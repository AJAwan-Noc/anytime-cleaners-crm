import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { AdminConfig, NotificationRecipient } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Loader2, Save, Trash2, Plus, Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import ServiceTypesSection from '@/components/admin/ServiceTypesSection';

// ── helpers ──
function configMap(rows: AdminConfig[]): Record<string, string> {
  const m: Record<string, string> = {};
  rows.forEach((r) => (m[r.key] = r.value));
  return m;
}

function replaceVars(tpl: string) {
  return tpl.replace(/\{name\}/g, 'John Smith').replace(/\{service\}/g, 'Deep Clean');
}

// ── Section wrapper ──
function SettingsSection({
  title,
  description,
  saving,
  onSave,
  children,
}: {
  title: string;
  description: string;
  saving: boolean;
  onSave: () => void;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {children}
        <div className="flex justify-end pt-2">
          <Button onClick={onSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Email toggle items ──
type EmailToggle = { key: string; label: string; desc: string };

const EMAIL_TOGGLES: EmailToggle[] = [
  { key: 'email_welcome_enabled', label: 'Welcome Email', desc: 'Send welcome email to new leads' },
  { key: 'email_team_alert_enabled', label: 'Team Alerts', desc: 'Alert team members of new leads' },
  { key: 'email_stage_alert_enabled', label: 'Stage Change Alerts', desc: 'Notify on lead stage changes' },
  { key: 'email_followup_enabled', label: 'Follow-up Reminders', desc: 'Send automatic follow-up reminders' },
  { key: 'email_booking_confirmation_enabled', label: 'Booking Confirmation', desc: 'Send booking confirmation to clients' },
  { key: 'email_invoice_enabled', label: 'Invoice Emails', desc: 'Send invoice emails to clients' },
  { key: 'email_report_enabled', label: 'AI Reports', desc: 'Send periodic AI summary reports' },
];

const JOB_EMAIL_TOGGLES: EmailToggle[] = [
  { key: 'email_job_assigned_cleaner_enabled', label: 'Job Assigned — Cleaner', desc: 'Job assigned — notify cleaner' },
  { key: 'email_job_assigned_agent_enabled', label: 'Job Assigned — Agent', desc: 'Job assigned — notify agent' },
  { key: 'email_job_started_lead_enabled', label: 'Job Started — Client', desc: 'Job started — notify client' },
  { key: 'email_job_started_manager_enabled', label: 'Job Started — Managers', desc: 'Job started — notify managers' },
  { key: 'email_job_started_agent_enabled', label: 'Job Started — Agent', desc: 'Job started — notify agent' },
  { key: 'email_job_completed_lead_enabled', label: 'Job Completed — Client', desc: 'Job completed — notify client' },
  { key: 'email_job_completed_manager_enabled', label: 'Job Completed — Managers', desc: 'Job completed — notify managers' },
  { key: 'email_job_completed_agent_enabled', label: 'Job Completed — Agent', desc: 'Job completed — notify agent' },
];

function EmailTogglesSection({ cfg, qc }: { cfg: Record<string, string>; qc: any }) {
  const [savedKey, setSavedKey] = useState<string | null>(null);

  const toggle = async (key: string, checked: boolean) => {
    try {
      const { error } = await supabase
        .from('admin_config')
        .upsert({ key, value: String(checked), updated_at: new Date().toISOString() }, { onConflict: 'key' });
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ['admin_config'] });
      setSavedKey(key);
      setTimeout(() => setSavedKey(null), 1500);
    } catch (e: any) {
      toast.error(e.message || 'Failed to save');
    }
  };

  const renderToggle = (t: EmailToggle) => (
    <div key={t.key} className="flex items-center justify-between py-1">
      <div className="space-y-0.5">
        <Label className="text-sm font-medium">{t.label}</Label>
        <p className="text-xs text-muted-foreground">{t.desc}</p>
      </div>
      <div className="flex items-center gap-2">
        {savedKey === t.key && <Check className="h-4 w-4 text-green-500 animate-in fade-in" />}
        <Switch
          checked={cfg[t.key] === 'true'}
          onCheckedChange={(v) => toggle(t.key, v)}
        />
      </div>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Email Notifications</CardTitle>
        <CardDescription>Toggle which automated emails are active. Changes save automatically.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {EMAIL_TOGGLES.map(renderToggle)}

        <div className="pt-4 mt-2 border-t">
          <h3 className="text-sm font-semibold text-foreground mb-3">Job Notifications</h3>
          <div className="space-y-4">
            {JOB_EMAIL_TOGGLES.map(renderToggle)}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main page ──
export default function AdminSettings() {
  const qc = useQueryClient();

  // Fetch config rows
  const { data: configRows = [], isLoading: configLoading } = useQuery({
    queryKey: ['admin_config'],
    queryFn: async () => {
      const { data, error } = await supabase.from('admin_config').select('*');
      if (error) throw error;
      return data as AdminConfig[];
    },
  });

  const cfg = configMap(configRows);

  // ── local state per section ──
  const [company, setCompany] = useState({ tax_rate: '' });
  const [automation, setAutomation] = useState({ follow_up_days: '' });

  useEffect(() => {
    if (configRows.length) {
      setCompany({ tax_rate: cfg.tax_rate ?? '' });
      setAutomation({ follow_up_days: cfg.follow_up_days ?? '' });
    }
  }, [configRows]);

  // ── save helpers ──
  const [savingSection, setSavingSection] = useState<string | null>(null);

  const saveKeys = useCallback(
    async (keys: Record<string, string>, section: string) => {
      setSavingSection(section);
      try {
        for (const [key, value] of Object.entries(keys)) {
          const { error } = await supabase
            .from('admin_config')
            .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
          if (error) throw error;
        }
        toast.success(`${section} settings saved`);
        qc.invalidateQueries({ queryKey: ['admin_config'] });
      } catch (e: any) {
        toast.error(e.message || 'Failed to save');
      } finally {
        setSavingSection(null);
      }
    },
    [qc],
  );

  // ── Notification Recipients ──
  const { data: recipients = [], isLoading: recipientsLoading } = useQuery({
    queryKey: ['notification_recipients'],
    queryFn: async () => {
      const { data, error } = await supabase.from('notification_recipients').select('*').order('created_at');
      if (error) throw error;
      return data as NotificationRecipient[];
    },
  });

  const toggleRecipientField = async (id: string, field: string, value: boolean) => {
    const { error } = await supabase.from('notification_recipients').update({ [field]: value }).eq('id', id);
    if (error) {
      toast.error('Failed to update');
    } else {
      qc.invalidateQueries({ queryKey: ['notification_recipients'] });
    }
  };

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('notification_recipients').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Recipient deleted');
      qc.invalidateQueries({ queryKey: ['notification_recipients'] });
      setDeleteId(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Add recipient modal
  const [addOpen, setAddOpen] = useState(false);
  const [newRecipient, setNewRecipient] = useState({ name: '', email: '' });
  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('notification_recipients').insert({
        name: newRecipient.name.trim(),
        email: newRecipient.email.trim(),
        is_active: true,
        notify_new_lead: true,
        notify_stage_change: true,
        notify_invoice: true,
        notify_report: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Recipient added');
      qc.invalidateQueries({ queryKey: ['notification_recipients'] });
      setAddOpen(false);
      setNewRecipient({ name: '', email: '' });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (configLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold">Admin Settings</h1>

      {/* ── Default Message Templates ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Default Message Templates</CardTitle>
          <CardDescription>How automated messages are managed.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">
            Email templates are fully managed in the <span className="font-medium text-foreground">Email Templates</span> section in the sidebar. SMS templates will be available when SMS is configured.
          </div>
        </CardContent>
      </Card>

      {/* ── Service Types ── */}
      <ServiceTypesSection />

      {/* ── Company ── */}
      <SettingsSection
        title="Company"
        description="Tax rate applied to invoices."
        saving={savingSection === 'Company'}
        onSave={() => {
          const rate = Number(company.tax_rate);
          if (isNaN(rate) || rate < 0 || rate > 100) {
            toast.error('Tax rate must be between 0 and 100');
            return;
          }
          saveKeys(company, 'Company');
        }}
      >
        <div className="space-y-1">
          <Label>Tax Rate</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              max={100}
              value={company.tax_rate}
              onChange={(e) => setCompany((p) => ({ ...p, tax_rate: e.target.value }))}
              className="max-w-[120px]"
            />
            <span className="text-sm text-muted-foreground">%</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Company name and invoice prefix are fixed at setup.
        </p>
      </SettingsSection>

      {/* ── Automation Rules ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Automation Rules</CardTitle>
          <CardDescription>Background workflows that run automatically. Only Lead Follow-Up has a configurable setting.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Rule 1 — Lead Follow-Up */}
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-sm">Lead Follow-Up</h3>
              <Badge className="bg-green-100 text-green-800 hover:bg-green-100" variant="secondary">Active</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Leads in Contacted stage with no update for the configured number of days are automatically moved to Not Responding and sent a follow-up email.
            </p>
            <div className="space-y-1 pt-1">
              <Label className="text-xs">Follow-Up Days</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={automation.follow_up_days}
                  onChange={(e) => setAutomation({ follow_up_days: e.target.value })}
                  className="max-w-[120px]"
                />
                <Button
                  size="sm"
                  onClick={() => {
                    const d = Number(automation.follow_up_days);
                    if (isNaN(d) || d < 1 || d > 30) {
                      toast.error('Follow-up days must be between 1 and 30');
                      return;
                    }
                    saveKeys(automation, 'Automation');
                  }}
                  disabled={savingSection === 'Automation'}
                  className="gap-2"
                >
                  {savingSection === 'Automation' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save
                </Button>
              </div>
            </div>
          </div>

          {/* Rule 2 — Invoice Overdue Detection */}
          <div className="rounded-lg border p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-sm">Invoice Overdue Detection</h3>
              <Badge className="bg-green-100 text-green-800 hover:bg-green-100" variant="secondary">Active</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Invoices with sent status are automatically marked as Overdue if unpaid 14 days after the service date. Runs daily at 9AM Sydney time.
            </p>
          </div>

          {/* Rule 3 — Feedback Request */}
          <div className="rounded-lg border p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-sm">Feedback Request</h3>
              <Badge className="bg-green-100 text-green-800 hover:bg-green-100" variant="secondary">Active</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              A feedback request email is automatically sent to clients 24 hours after their lead is moved to Booked stage, if feedback has not already been requested.
            </p>
          </div>

          {/* Rule 4 — Recurring Job Generator */}
          <div className="rounded-lg border p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-sm">Recurring Job Generator</h3>
              <Badge className="bg-green-100 text-green-800 hover:bg-green-100" variant="secondary">Active</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Active recurring schedules are checked daily and new jobs are automatically created and assigned based on each schedule's rules. Cleaner is notified by email when a new job is generated.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── Notification Recipients ── */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle className="text-lg">Notification Recipients</CardTitle>
            <CardDescription>People who receive email notifications for CRM events.</CardDescription>
          </div>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1">
                <Plus className="h-4 w-4" /> Add
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Recipient</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <div className="space-y-1">
                  <Label>Name *</Label>
                  <Input
                    value={newRecipient.name}
                    onChange={(e) => setNewRecipient((p) => ({ ...p, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Email *</Label>
                  <Input
                    type="email"
                    value={newRecipient.email}
                    onChange={(e) => setNewRecipient((p) => ({ ...p, email: e.target.value }))}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  disabled={!newRecipient.name.trim() || !newRecipient.email.trim() || addMutation.isPending}
                  onClick={() => addMutation.mutate()}
                  className="gap-2"
                >
                  {addMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Add Recipient
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {recipientsLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : recipients.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No recipients configured.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-center">New Lead</TableHead>
                  <TableHead className="text-center">Stage Change</TableHead>
                  <TableHead className="text-center">Invoice</TableHead>
                  <TableHead className="text-center">Reports</TableHead>
                  <TableHead className="text-center">Active</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {recipients.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="text-muted-foreground">{r.email}</TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={r.notify_new_lead}
                        onCheckedChange={(v) => toggleRecipientField(r.id, 'notify_new_lead', v)}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={r.notify_stage_change}
                        onCheckedChange={(v) => toggleRecipientField(r.id, 'notify_stage_change', v)}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={r.notify_invoice}
                        onCheckedChange={(v) => toggleRecipientField(r.id, 'notify_invoice', v)}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={r.notify_report}
                        onCheckedChange={(v) => toggleRecipientField(r.id, 'notify_report', v)}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={r.is_active}
                        onCheckedChange={(v) => toggleRecipientField(r.id, 'is_active', v)}
                      />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteId(r.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── Email Notifications ── */}
      <EmailTogglesSection cfg={cfg} qc={qc} />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Recipient</AlertDialogTitle>
            <AlertDialogDescription>
              This recipient will no longer receive notifications. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
