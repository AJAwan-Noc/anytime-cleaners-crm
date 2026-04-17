import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Invoice, InvoiceStatus, INVOICE_STATUS_COLORS } from '@/types';
import { useNavigate } from 'react-router-dom';
import { Loader2, FileText, DollarSign, Clock, FilePlus, AlertTriangle, Trash2, Plus } from 'lucide-react';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';

type InvoiceWithLead = Invoice & { lead: { full_name: string } | null };

export default function Invoices() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [deleteTarget, setDeleteTarget] = useState<InvoiceWithLead | null>(null);

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*, lead:leads(full_name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as InvoiceWithLead[];
    },
  });

  const filtered = statusFilter === 'all'
    ? invoices
    : invoices.filter(i => i.status === statusFilter);

  const paidTotal = invoices
    .filter(i => i.status === 'paid')
    .reduce((s, i) => s + (i.total || 0), 0);

  const outstandingTotal = invoices
    .filter(i => i.status === 'sent' || i.status === 'overdue')
    .reduce((s, i) => s + (i.total || 0), 0);

  const overdueCount = invoices.filter(i => i.status === 'overdue').length;
  const draftCount = invoices.filter(i => i.status === 'draft').length;

  const fmtAUD = (v: number) =>
    new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(v);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const { error } = await supabase.from('invoices').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      toast.success(`Invoice ${deleteTarget.invoice_number} deleted`);
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete invoice');
    } finally {
      setDeleteTarget(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Invoices</h1>
        <Button onClick={() => navigate('/invoices/new')}>
          <Plus className="mr-1 h-4 w-4" /> Create Invoice
        </Button>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <DollarSign className="h-8 w-8 text-green-600" />
            <div>
              <p className="text-sm text-muted-foreground">Total Revenue</p>
              <p className="text-xl font-bold">{fmtAUD(paidTotal)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Clock className="h-8 w-8 text-blue-600" />
            <div>
              <p className="text-sm text-muted-foreground">Outstanding</p>
              <p className="text-xl font-bold">{fmtAUD(outstandingTotal)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <AlertTriangle className={`h-8 w-8 ${overdueCount > 0 ? 'text-red-600' : 'text-gray-400'}`} />
            <div>
              <p className="text-sm text-muted-foreground">Overdue</p>
              <p className={`text-xl font-bold ${overdueCount > 0 ? 'text-red-600' : ''}`}>{overdueCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <FilePlus className="h-8 w-8 text-gray-500" />
            <div>
              <p className="text-sm text-muted-foreground">Drafts</p>
              <p className="text-xl font-bold">{draftCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-muted-foreground">Filter:</span>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Invoice table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
          <FileText className="h-12 w-12" />
          <p>No invoices found.</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice #</TableHead>
              <TableHead>Lead Name</TableHead>
              <TableHead>Service Date</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(inv => (
              <TableRow
                key={inv.id}
                className="cursor-pointer"
                onClick={() => navigate(`/invoices/${inv.id}`)}
              >
                <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                <TableCell>{inv.lead?.full_name ?? '—'}</TableCell>
                <TableCell>
                  {inv.service_date
                    ? format(parseISO(inv.service_date), 'dd/MM/yyyy')
                    : '—'}
                </TableCell>
                <TableCell className="text-right">{fmtAUD(inv.total || 0)}</TableCell>
                <TableCell>
                  {inv.status === 'paid' && inv.paid_at ? (
                    <TooltipProvider delayDuration={150}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="inline-flex flex-col items-start gap-0.5">
                            <Badge className={INVOICE_STATUS_COLORS[inv.status as InvoiceStatus]}>
                              Paid
                            </Badge>
                            <span className="text-[11px] text-muted-foreground">
                              {inv.payment_method ?? '—'} · {format(parseISO(inv.paid_at), 'dd/MM/yyyy')}
                            </span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          Paid via {inv.payment_method ?? '—'} on {format(parseISO(inv.paid_at), 'dd/MM/yyyy')}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    <Badge className={INVOICE_STATUS_COLORS[inv.status as InvoiceStatus]}>
                      {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={e => { e.stopPropagation(); setDeleteTarget(inv); }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Invoice</AlertDialogTitle>
            <AlertDialogDescription>
              Delete invoice {deleteTarget?.invoice_number}? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
