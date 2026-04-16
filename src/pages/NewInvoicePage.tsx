import { useState, useEffect, useCallback } from 'react';

import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase, N8N_BASE_URL } from '@/lib/supabase';
import { Lead, LineItem } from '@/types';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Loader2, Plus, Trash2, ArrowLeft, CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';

const fmtAUD = (v: number) =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(v);

async function generateInvoiceNumber(): Promise<string> {
  const { data } = await supabase
    .from('invoices')
    .select('invoice_number')
    .order('invoice_number', { ascending: false })
    .limit(1);
  const last = data?.[0]?.invoice_number;
  const num = last ? parseInt(last.replace('AC-', ''), 10) + 1 : 1;
  return `AC-${String(num).padStart(4, '0')}`;
}

export default function NewInvoicePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const paramLeadId = searchParams.get('lead_id');

  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(paramLeadId);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [notes, setNotes] = useState('');
  const [serviceDate, setServiceDate] = useState<Date | undefined>(new Date());
  const [saving, setSaving] = useState<string | null>(null);
  const [confirmSend, setConfirmSend] = useState(false);

  // Fetch all leads for the dropdown when no lead_id param
  const { data: allLeads = [] } = useQuery({
    queryKey: ['leads-for-invoice'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('id, full_name, email, phone, address, service_type')
        .eq('is_archived', false)
        .order('full_name');
      if (error) throw error;
      return data as Pick<Lead, 'id' | 'full_name' | 'email' | 'phone' | 'address' | 'service_type'>[];
    },
  });

  const { data: lead, isLoading: leadLoading } = useQuery({
    queryKey: ['lead', selectedLeadId],
    queryFn: async () => {
      const { data, error } = await supabase.from('leads').select('*').eq('id', selectedLeadId!).single();
      if (error) throw error;
      return data as Lead;
    },
    enabled: !!selectedLeadId,
  });

  const { data: taxRateConfig } = useQuery({
    queryKey: ['admin-config-tax-rate'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_config')
        .select('value')
        .eq('key', 'tax_rate')
        .single();
      if (error) return null;
      return data;
    },
  });

  const taxRate = taxRateConfig ? parseFloat(taxRateConfig.value) : 10;

  useEffect(() => {
    generateInvoiceNumber().then(setInvoiceNumber);
  }, []);

  useEffect(() => {
    if (lead && lineItems.length === 0) {
      setLineItems([{ description: lead.service_type || '', quantity: 1, unit_price: 0, total: 0 }]);
    }
  }, [lead]);

  const safeItems = Array.isArray(lineItems) ? lineItems : [];
  const subtotal = safeItems.reduce((s, li) => s + li.quantity * li.unit_price, 0);
  const gst = subtotal * (taxRate / 100);
  const total = subtotal + gst;

  const updateItem = useCallback((idx: number, field: keyof LineItem, value: string | number) => {
    setLineItems(prev => {
      const copy = [...prev];
      const item = { ...copy[idx] };
      if (field === 'description') item.description = value as string;
      else if (field === 'quantity') item.quantity = Number(value) || 0;
      else if (field === 'unit_price') item.unit_price = Number(value) || 0;
      item.total = item.quantity * item.unit_price;
      copy[idx] = item;
      return copy;
    });
  }, []);

  const addItem = () =>
    setLineItems(prev => [...prev, { description: '', quantity: 1, unit_price: 0, total: 0 }]);

  const removeItem = (idx: number) =>
    setLineItems(prev => prev.filter((_, i) => i !== idx));

  const saveInvoice = async (status: 'draft' | 'sent') => {
    if (!selectedLeadId) {
      toast.error('No lead selected');
      return;
    }
    setSaving(status);
    try {
      const payload = {
        lead_id: selectedLeadId,
        invoice_number: invoiceNumber,
        service_date: serviceDate ? format(serviceDate, 'yyyy-MM-dd') : null,
        line_items: lineItems.map(li => ({ ...li, total: li.quantity * li.unit_price })),
        subtotal,
        tax_rate: taxRate,
        total,
        notes,
        status,
      };

      let data: { id: string };
      const { data: d1, error: e1 } = await supabase
        .from('invoices')
        .insert(payload)
        .select('id')
        .single();
      if (e1) {
        if (e1.code === '23505') {
          // Duplicate invoice number — regenerate and retry once
          const retryNumber = await generateInvoiceNumber();
          setInvoiceNumber(retryNumber);
          payload.invoice_number = retryNumber;
          const { data: d2, error: e2 } = await supabase
            .from('invoices')
            .insert(payload)
            .select('id')
            .single();
          if (e2) throw e2;
          data = d2;
        } else {
          throw e1;
        }
      } else {
        data = d1;
      }

      if (status === 'sent') {
        try {
          await fetch(`${N8N_BASE_URL}/create-invoice`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              lead_id: selectedLeadId,
              invoice_id: data.id,
              line_items: lineItems,
              service_date: serviceDate ? format(serviceDate, 'yyyy-MM-dd') : null,
            }),
          });
        } catch {
          // n8n webhook failure shouldn't block save
        }
      }

      toast.success(status === 'draft' ? 'Invoice saved as draft' : 'Invoice sent to client');
      navigate(`/invoices/${data.id}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create invoice');
    } finally {
      setSaving(null);
    }
  };

  if (leadLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
        <ArrowLeft className="mr-1 h-4 w-4" /> Back
      </Button>

      <Card>
        <CardContent className="space-y-8 p-8">
          {/* Header */}
          <div>
            <h1 className="text-2xl font-bold">New Invoice</h1>
            <p className="text-lg font-mono text-muted-foreground">{invoiceNumber}</p>
          </div>

          {/* Service Date */}
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Service Date</p>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-[240px] justify-start text-left font-normal',
                    !serviceDate && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {serviceDate ? format(serviceDate, 'dd/MM/yyyy') : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={serviceDate}
                  onSelect={setServiceDate}
                  initialFocus
                  className={cn('p-3 pointer-events-auto')}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Lead selector */}
          {!paramLeadId && (
            <div className="space-y-1.5">
              <Label>Select Lead</Label>
              <Select value={selectedLeadId ?? ''} onValueChange={(v) => setSelectedLeadId(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a lead…" />
                </SelectTrigger>
                <SelectContent>
                  {allLeads.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.full_name} {l.phone ? `— ${l.phone}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Bill-to */}
          {lead && (
            <div className="rounded-md border p-4">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Bill To</p>
              <p className="font-medium">{lead.full_name}</p>
              {lead.email && <p className="text-sm text-muted-foreground">{lead.email}</p>}
              <p className="text-sm text-muted-foreground">{lead.phone}</p>
              {lead.address && <p className="text-sm text-muted-foreground">{lead.address}</p>}
              {lead.service_type && <p className="text-sm text-muted-foreground">Service: {lead.service_type}</p>}
            </div>
          )}

          {/* Line items */}
          <div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40%]">Description</TableHead>
                  <TableHead className="w-[15%] text-right">Qty</TableHead>
                  <TableHead className="w-[20%] text-right">Unit Price</TableHead>
                  <TableHead className="w-[15%] text-right">Total</TableHead>
                  <TableHead className="w-[10%]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {safeItems.map((li, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <Input
                        value={li.description}
                        onChange={e => updateItem(idx, 'description', e.target.value)}
                        className="h-8"
                        placeholder="Service description"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        value={li.quantity}
                        onChange={e => updateItem(idx, 'quantity', e.target.value)}
                        className="h-8 text-right"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={li.unit_price}
                        onChange={e => updateItem(idx, 'unit_price', e.target.value)}
                        className="h-8 text-right"
                      />
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {fmtAUD(li.quantity * li.unit_price)}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeItem(idx)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <Button variant="outline" size="sm" className="mt-2" onClick={addItem}>
              <Plus className="mr-1 h-4 w-4" /> Add Line Item
            </Button>

            {/* Totals */}
            <div className="mt-4 flex justify-end">
              <div className="w-64 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{fmtAUD(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">GST ({taxRate}%)</span>
                  <span>{fmtAUD(gst)}</span>
                </div>
                <div className="flex justify-between border-t pt-1 font-bold">
                  <span>Total</span>
                  <span>{fmtAUD(total)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <p className="mb-1 text-sm font-medium">Notes</p>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Additional notes…"
            />
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => saveInvoice('draft')} disabled={!!saving}>
              {saving === 'draft' && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Save as Draft
            </Button>
            <Button
              variant="outline"
              onClick={() => setConfirmSend(true)}
              disabled={!!saving}
            >
              {saving === 'sent' && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Send Invoice to Client
            </Button>
          </div>

          {/* Confirm send dialog */}
          <AlertDialog open={confirmSend} onOpenChange={setConfirmSend}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Send Invoice {invoiceNumber}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will send the invoice to the client. Are you sure?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => { setConfirmSend(false); saveInvoice('sent'); }}>
                  Send Invoice
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
