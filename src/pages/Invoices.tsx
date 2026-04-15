import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Invoice, InvoiceStatus, INVOICE_STATUS_COLORS } from '@/types';
import { useNavigate } from 'react-router-dom';
import { Loader2, FileText, DollarSign, Clock, FilePlus } from 'lucide-react';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { format, parseISO } from 'date-fns';

export default function Invoices() {
  const navigate = useNavigate();

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*, lead:leads(full_name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as (Invoice & { lead: { full_name: string } | null })[];
    },
  });

  const paidTotal = invoices
    .filter(i => i.status === 'paid')
    .reduce((s, i) => s + (i.total || 0), 0);

  const outstandingTotal = invoices
    .filter(i => i.status === 'sent' || i.status === 'overdue')
    .reduce((s, i) => s + (i.total || 0), 0);

  const draftCount = invoices.filter(i => i.status === 'draft').length;

  const fmtAUD = (v: number) =>
    new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(v);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">Invoices</h1>

      {/* Summary bar */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
            <FilePlus className="h-8 w-8 text-gray-500" />
            <div>
              <p className="text-sm text-muted-foreground">Drafts</p>
              <p className="text-xl font-bold">{draftCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Invoice table */}
      {invoices.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
          <FileText className="h-12 w-12" />
          <p>No invoices yet.</p>
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map(inv => (
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
                  <Badge className={INVOICE_STATUS_COLORS[inv.status as InvoiceStatus]}>
                    {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
