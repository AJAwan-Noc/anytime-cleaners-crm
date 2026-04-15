import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Invoice, LineItem, InvoiceStatus, INVOICE_STATUS_COLORS } from '@/types';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { Loader2, Plus, Trash2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type InvoiceWithLead = Omit<Invoice, 'lead'> & {
  lead: {
    full_name: string;
    email: string | null;
    phone: string;
    address: string | null;
  } | null;
};

const fmtAUD = (v: number) =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(v);

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState<string | null>(null);
  const [confirmPaid, setConfirmPaid] = useState(false);

  const { data: invoice, isLoading } = useQuery({
    queryKey: ['invoice', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*, lead:leads(full_name, email, phone, address)')
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data as InvoiceWithLead;
    },
    enabled: !!id,
  });

  useEffect(() => {
    if (invoice) {
      const items = Array.isArray(invoice.line_items) ? invoice.line_items : [];
      setLineItems(items);
      setNotes(invoice.notes ?? '');
    }
  }, [invoice]);

  const safeItems = Array.isArray(lineItems) ? lineItems : [];
  const subtotal = safeItems.reduce((s, li) => s + li.quantity * li.unit_price, 0);
  const taxRate = invoice?.tax_rate ?? 10;
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

  const saveInvoice = async (statusOverride?: InvoiceStatus) => {
    const label = statusOverride ?? 'draft';
    setSaving(label);
    try {
      const payload: Record<string, unknown> = {
        line_items: lineItems.map(li => ({ ...li, total: li.quantity * li.unit_price })),
        subtotal,
        tax_rate: taxRate,
        total,
        notes,
      };
      if (statusOverride) payload.status = statusOverride;

      const { error } = await supabase
        .from('invoices')
        .update(payload)
        .eq('id', id!);
      if (error) throw error;

      toast.success(`Invoice ${statusOverride ? `marked as ${statusOverride}` : 'saved'}`);
      queryClient.invalidateQueries({ queryKey: ['invoice', id] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    } catch (err: any) {
      toast.error(err.message || 'Failed to save invoice');
    } finally {
      setSaving(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!invoice) {
    return <p className="p-6 text-muted-foreground">Invoice not found.</p>;
  }

  const lead = invoice.lead;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      {/* Back */}
      <Button variant="ghost" size="sm" onClick={() => navigate('/invoices')}>
        <ArrowLeft className="mr-1 h-4 w-4" /> Back to Invoices
      </Button>

      {/* Invoice card */}
      <Card className="print:shadow-none print:border-none">
        <CardContent className="space-y-8 p-8">
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">{invoice.invoice_number}</h1>
              <p className="text-sm text-muted-foreground">
                Issued {format(parseISO(invoice.created_at), 'dd/MM/yyyy')}
              </p>
              {invoice.service_date && (
                <p className="text-sm text-muted-foreground">
                  Service date {format(parseISO(invoice.service_date), 'dd/MM/yyyy')}
                </p>
              )}
            </div>
            <Badge className={INVOICE_STATUS_COLORS[invoice.status as InvoiceStatus] + ' text-sm px-3 py-1'}>
              {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
            </Badge>
          </div>

          {/* Bill-to */}
          {lead && (
            <div className="rounded-md border p-4">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Bill To</p>
              <p className="font-medium">{lead.full_name}</p>
              {lead.email && <p className="text-sm text-muted-foreground">{lead.email}</p>}
              <p className="text-sm text-muted-foreground">{lead.phone}</p>
              {lead.address && <p className="text-sm text-muted-foreground">{lead.address}</p>}
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
                {lineItems.map((li, idx) => (
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
          <div className="flex flex-wrap gap-3 print:hidden">
            <Button onClick={() => saveInvoice()} disabled={!!saving}>
              {saving === 'draft' && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Save Draft
            </Button>
            <Button
              variant="outline"
              onClick={() => saveInvoice('sent')}
              disabled={!!saving}
            >
              {saving === 'sent' && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Mark as Sent
            </Button>
            <Button
              variant="outline"
              onClick={() => setConfirmPaid(true)}
              disabled={!!saving}
            >
              {saving === 'paid' && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Mark as Paid
            </Button>
            <Button
              variant="outline"
              onClick={() => saveInvoice('overdue')}
              disabled={!!saving}
            >
              {saving === 'overdue' && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Mark as Overdue
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Confirm paid dialog */}
      <AlertDialog open={confirmPaid} onOpenChange={setConfirmPaid}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Payment</AlertDialogTitle>
            <AlertDialogDescription>
              Mark invoice {invoice.invoice_number} as paid? This indicates payment has been received.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setConfirmPaid(false); saveInvoice('paid'); }}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
