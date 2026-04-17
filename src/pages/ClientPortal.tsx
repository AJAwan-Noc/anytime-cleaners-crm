import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase, N8N_BASE_URL } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Job, Invoice, JOB_STATUS_COLORS, JOB_STATUS_LABELS, INVOICE_STATUS_COLORS } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LogOut, Plus, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function ClientPortal() {
  const { user, signOut } = useAuth();
  const [bookingOpen, setBookingOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const email = user?.email?.toLowerCase() ?? '';

  const { data: leadIds = [] } = useQuery({
    queryKey: ['client-leads', email],
    enabled: !!email,
    queryFn: async () => {
      const { data } = await supabase.from('leads').select('id, address').ilike('email', email);
      return (data ?? []) as { id: string; address: string | null }[];
    },
  });

  const ids = leadIds.map((l) => l.id);
  const lastAddress = leadIds[0]?.address ?? '';

  const { data: jobs = [] } = useQuery({
    queryKey: ['client-jobs', ids.join(',')],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from('jobs')
        .select('*, assigned_member:team_members!jobs_assigned_to_fkey(id,name)')
        .in('lead_id', ids)
        .order('scheduled_date', { ascending: false });
      return (data ?? []) as Job[];
    },
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['client-invoices', ids.join(',')],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from('invoices')
        .select('*')
        .in('lead_id', ids)
        .order('created_at', { ascending: false });
      return (data ?? []) as Invoice[];
    },
  });

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="bg-background border-b sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-primary">Anytime Cleaners</h1>
            <p className="text-xs text-muted-foreground">Client Portal</p>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground hidden sm:inline">{user?.email}</span>
            <Button variant="ghost" size="sm" onClick={signOut} className="gap-1"><LogOut className="h-4 w-4" /> Logout</Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Welcome back!</h2>
          <Button onClick={() => setBookingOpen(true)} className="gap-1"><Plus className="h-4 w-4" /> Request New Booking</Button>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">My Jobs</CardTitle></CardHeader>
          <CardContent>
            {jobs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No jobs scheduled.</p>
            ) : (
              <div className="space-y-2">
                {jobs.map((j) => (
                  <div key={j.id} className="flex items-center justify-between border rounded-md p-3 text-sm">
                    <div>
                      <p className="font-medium">{j.service_type ?? 'Cleaning'}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(j.scheduled_date), 'PP')} at {j.scheduled_time?.slice(0, 5)} · {j.assigned_member?.name ?? 'TBD'}
                      </p>
                    </div>
                    <Badge className={JOB_STATUS_COLORS[j.status]}>{JOB_STATUS_LABELS[j.status]}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">My Invoices</CardTitle></CardHeader>
          <CardContent>
            {invoices.length === 0 ? (
              <p className="text-sm text-muted-foreground">No invoices yet.</p>
            ) : (
              <div className="space-y-2">
                {invoices.map((inv) => (
                  <div key={inv.id} className="border rounded-md text-sm overflow-hidden">
                    <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/40" onClick={() => setExpanded(expanded === inv.id ? null : inv.id)}>
                      <div>
                        <p className="font-mono font-medium">{inv.invoice_number}</p>
                        <p className="text-xs text-muted-foreground">{format(new Date(inv.service_date), 'PP')}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold">${inv.total.toFixed(2)}</span>
                        <Badge className={INVOICE_STATUS_COLORS[inv.status]}>{inv.status}</Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            fetch(`${N8N_BASE_URL}/create-invoice`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ lead_id: inv.lead_id, invoice_id: inv.id }),
                            }).then(() => toast.success('Invoice download requested'))
                              .catch(() => toast.error('Failed to request'));
                          }}
                        >
                          <FileText className="h-3 w-3" /> Download
                        </Button>
                      </div>
                    </div>
                    {expanded === inv.id && (
                      <div className="border-t p-3 bg-muted/30 space-y-1">
                        {inv.line_items.map((li, i) => (
                          <div key={i} className="flex justify-between text-xs">
                            <span>{li.description} (×{li.quantity})</span>
                            <span>${li.total.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <BookingDialog open={bookingOpen} onClose={() => setBookingOpen(false)} email={email} address={lastAddress} />
    </div>
  );
}

function BookingDialog({ open, onClose, email, address }: { open: boolean; onClose: () => void; email: string; address: string }) {
  const [form, setForm] = useState({
    service_type: 'Regular Cleaning',
    preferred_date: '',
    preferred_time: '09:00',
    address: address,
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    try {
      const prefixedNotes = `CLIENT PORTAL REQUEST: ${form.notes}`.trim();
      const res = await fetch(`${N8N_BASE_URL}/new-lead`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          notes: prefixedNotes,
          email,
          source: 'website',
        }),
      });
      if (!res.ok) throw new Error();
      setDone(true);
    } catch {
      toast.error('Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setDone(false); onClose(); } }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Request a Booking</DialogTitle></DialogHeader>
        {done ? (
          <div className="py-6 text-center space-y-2">
            <p className="text-base font-medium">Your request has been received.</p>
            <p className="text-sm text-muted-foreground">We will be in touch shortly.</p>
            <Button onClick={() => { setDone(false); onClose(); }} className="mt-2">Close</Button>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <div>
                <Label>Service Type</Label>
                <Select value={form.service_type} onValueChange={(v) => setForm((p) => ({ ...p, service_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['Regular Cleaning', 'Deep Clean', 'Move-In-Out', 'Commercial', 'Window Cleaning', 'Other'].map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Preferred Date</Label><Input type="date" value={form.preferred_date} onChange={(e) => setForm((p) => ({ ...p, preferred_date: e.target.value }))} /></div>
                <div><Label>Preferred Time</Label><Input type="time" value={form.preferred_time} onChange={(e) => setForm((p) => ({ ...p, preferred_time: e.target.value }))} /></div>
              </div>
              <div><Label>Address</Label><Input value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} /></div>
              <div><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} /></div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
              <Button onClick={submit} disabled={submitting || !form.preferred_date}>
                {submitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Submit Request
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
