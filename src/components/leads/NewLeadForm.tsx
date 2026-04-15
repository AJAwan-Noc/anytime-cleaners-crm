import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { N8N_BASE_URL } from '@/lib/supabase';
import { LeadSource } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, ArrowLeft } from 'lucide-react';

const SOURCES: LeadSource[] = ['website', 'facebook', 'instagram', 'referral', 'google', 'manual', 'other'];
const SERVICE_TYPES = ['Regular Cleaning', 'Deep Clean', 'Move-In-Out', 'Commercial', 'Window Cleaning', 'Other'];

interface FormState {
  full_name: string;
  email: string;
  phone: string;
  source: LeadSource;
  service_type: string;
  address: string;
  notes: string;
}

export default function NewLeadForm() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<FormState>({
    full_name: '',
    email: '',
    phone: '',
    source: 'manual',
    service_type: 'Regular Cleaning',
    address: '',
    notes: '',
  });

  const set = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.full_name.trim()) {
      toast.error('Full Name is required');
      return;
    }
    if (!form.phone.trim()) {
      toast.error('Phone is required');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${N8N_BASE_URL}/new-lead`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      toast.success('Lead created successfully');
      navigate('/leads');
    } catch {
      toast.error('Failed to create lead');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Button variant="ghost" onClick={() => navigate('/leads')} className="gap-1">
        <ArrowLeft className="h-4 w-4" /> Back to Leads
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>New Lead</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Full Name *</Label>
                <Input value={form.full_name} onChange={(e) => set('full_name', e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Phone *</Label>
                <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>Source</Label>
                <Select value={form.source} onValueChange={(v) => set('source', v as LeadSource)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SOURCES.map((s) => (
                      <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Service Type</Label>
                <Select value={form.service_type} onValueChange={(v) => set('service_type', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SERVICE_TYPES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Address</Label>
                <Input value={form.address} onChange={(e) => set('address', e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={3} />
            </div>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Create Lead
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
