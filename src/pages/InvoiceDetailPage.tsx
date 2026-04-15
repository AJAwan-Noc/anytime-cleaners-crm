import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, N8N_BASE_URL } from '@/lib/supabase';
import { Invoice, LineItem, InvoiceStatus, INVOICE_STATUS_COLORS } from '@/types';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { Loader2, Plus, Trash2, ArrowLeft, Eye, Copy } from 'lucide-react';
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
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

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

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState<string | null>(null);
  const [confirmPaid, setConfirmPaid] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

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

      // If sending, call n8n webhook
      if (statusOverride === 'sent') {
        try {
          await fetch(`${N8N_BASE_URL}/create-invoice`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              lead_id: invoice?.lead_id,
              invoice_id: id,
              line_items: lineItems,
              service_date: invoice?.service_date,
            }),
          });
        } catch {
          // n8n failure shouldn't block status update
        }
      }

      toast.success(`Invoice ${statusOverride ? `marked as ${statusOverride}` : 'saved'}`);
      queryClient.invalidateQueries({ queryKey: ['invoice', id] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    } catch (err: any) {
      toast.error(err.message || 'Failed to save invoice');
    } finally {
      setSaving(null);
    }
  };

  const deleteInvoice = async () => {
    setSaving('delete');
    try {
      const { error } = await supabase.from('invoices').delete().eq('id', id!);
      if (error) throw error;
      toast.success('Invoice deleted');
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      navigate('/invoices');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete invoice');
    } finally {
      setSaving(null);
    }
  };

  const duplicateInvoice = async () => {
    setSaving('duplicate');
    try {
      const newNumber = await generateInvoiceNumber();
      const payload = {
        lead_id: invoice!.lead_id,
        invoice_number: newNumber,
        service_date: invoice!.service_date,
        line_items: Array.isArray(invoice!.line_items) ? invoice!.line_items : [],
        subtotal: invoice!.subtotal,
        tax_rate: invoice!.tax_rate,
        total: invoice!.total,
        notes: invoice!.notes,
        status: 'draft',
      };
      const { data, error } = await supabase
        .from('invoices')
        .insert(payload)
        .select('id')
        .single();
      if (error) throw error;
      toast.success(`Invoice duplicated as ${newNumber}`);
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      navigate(`/invoices/${data.id}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to duplicate invoice');
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
            <div className="flex items-center gap-2">
              <Badge className={INVOICE_STATUS_COLORS[invoice.status as InvoiceStatus] + ' text-sm px-3 py-1'}>
                {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
              </Badge>
              <Button variant="outline" size="sm" onClick={() => setShowPreview(true)}>
                <Eye className="mr-1 h-4 w-4" /> Preview
              </Button>
              <Button variant="outline" size="sm" onClick={duplicateInvoice} disabled={!!saving}>
                {saving === 'duplicate' ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Copy className="mr-1 h-4 w-4" />}
                Duplicate
              </Button>
            </div>
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
              Send Invoice to Client
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

          {/* Delete button */}
          <div className="border-t pt-6 print:hidden">
            <Button
              variant="destructive"
              onClick={() => setConfirmDelete(true)}
              disabled={!!saving}
            >
              {saving === 'delete' && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              <Trash2 className="mr-1 h-4 w-4" /> Delete Invoice
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

      {/* Confirm delete dialog */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Invoice</AlertDialogTitle>
            <AlertDialogDescription>
              Delete invoice {invoice.invoice_number}? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { setConfirmDelete(false); deleteInvoice(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Preview modal */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Invoice Preview</DialogTitle>
          </DialogHeader>
          <InvoicePreview invoice={invoice} lineItems={safeItems} subtotal={subtotal} gst={gst} total={total} taxRate={taxRate} notes={notes} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InvoicePreview({
  invoice,
  lineItems,
  subtotal,
  gst,
  total,
  taxRate,
  notes,
}: {
  invoice: any;
  lineItems: LineItem[];
  subtotal: number;
  gst: number;
  total: number;
  taxRate: number;
  notes: string;
}) {
  const fmtAUD = (v: number) =>
    new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(v);
  const lead = invoice.lead;

  return (
    <div className="bg-white text-black rounded-lg overflow-hidden">
      {/* Header */}
      <div className="bg-[#4F46E5] text-white p-6">
        <h2 className="text-xl font-bold">Anytime Cleaners</h2>
        <p className="text-indigo-200 text-sm">Professional Cleaning Services</p>
      </div>

      <div className="p-6 space-y-6">
        {/* Invoice info */}
        <div className="flex justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-gray-500">Invoice</p>
            <p className="font-bold text-lg">{invoice.invoice_number}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase text-gray-500">Date</p>
            <p className="text-sm">{format(parseISO(invoice.created_at), 'dd/MM/yyyy')}</p>
            {invoice.service_date && (
              <>
                <p className="text-xs font-semibold uppercase text-gray-500 mt-2">Service Date</p>
                <p className="text-sm">{format(parseISO(invoice.service_date), 'dd/MM/yyyy')}</p>
              </>
            )}
          </div>
        </div>

        {/* Bill to */}
        {lead && (
          <div>
            <p className="text-xs font-semibold uppercase text-gray-500 mb-1">Bill To</p>
            <p className="font-medium">{lead.full_name}</p>
            {lead.email && <p className="text-sm text-gray-600">{lead.email}</p>}
            <p className="text-sm text-gray-600">{lead.phone}</p>
            {lead.address && <p className="text-sm text-gray-600">{lead.address}</p>}
          </div>
        )}

        {/* Line items table */}
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-gray-200">
              <th className="text-left py-2 font-semibold">Description</th>
              <th className="text-right py-2 font-semibold">Qty</th>
              <th className="text-right py-2 font-semibold">Unit Price</th>
              <th className="text-right py-2 font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((li, idx) => (
              <tr key={idx} className="border-b border-gray-100">
                <td className="py-2">{li.description}</td>
                <td className="py-2 text-right">{li.quantity}</td>
                <td className="py-2 text-right">{fmtAUD(li.unit_price)}</td>
                <td className="py-2 text-right">{fmtAUD(li.quantity * li.unit_price)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-64 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Subtotal</span>
              <span>{fmtAUD(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">GST ({taxRate}%)</span>
              <span>{fmtAUD(gst)}</span>
            </div>
            <div className="flex justify-between border-t-2 border-gray-300 pt-1 font-bold text-base">
              <span>Total</span>
              <span>{fmtAUD(total)}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {notes && (
          <div>
            <p className="text-xs font-semibold uppercase text-gray-500 mb-1">Notes</p>
            <p className="text-sm text-gray-600">{notes}</p>
          </div>
        )}

        {/* Footer */}
        <div className="border-t pt-4 text-center text-xs text-gray-400">
          <p>Thank you for choosing Anytime Cleaners!</p>
          <p>For questions about this invoice, please contact us.</p>
        </div>
      </div>
    </div>
  );
}
