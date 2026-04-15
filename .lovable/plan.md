

# Invoice Flow Overhaul

## Summary
Major rework of the invoice system: new invoice creation page, enhanced detail page with send/delete/duplicate/preview, improved list page with filters, and updated lead detail navigation.

## Changes

### 1. New Invoice Page (`src/pages/NewInvoicePage.tsx`)
- Route: `/invoices/new?lead_id=xxx`
- Fetch lead by `lead_id` query param, show bill-to section (name, email, phone, address, service_type)
- Auto-generate invoice number: query `invoices` table ordered by `invoice_number` desc, extract numeric part from `AC-XXXX`, increment, zero-pad to 4 digits
- Fetch `tax_rate` from `admin_config` table (key = `tax_rate`)
- Pre-populate first line item with lead's `service_type` as description, qty 1, price 0
- Service date picker using a date input
- Layout mirrors `InvoiceDetailPage` (bill-to, line items table, subtotal/GST/total, notes)
- **Save as Draft**: INSERT into `invoices` with status `draft`, redirect to `/invoices/:id`
- **Send Invoice to Client**: INSERT into `invoices` with status `sent`, POST to `N8N_BASE_URL/create-invoice` with `{ lead_id, invoice_id, line_items, service_date }`, redirect to `/invoices/:id`

### 2. Lead Detail — Generate Invoice Button (`src/components/leads/LeadDetail.tsx`)
- Replace the webhook call on "Generate Invoice" with `navigate(`/invoices/new?lead_id=${id}`)`
- Remove the `webhookAction('create-invoice', ...)` call

### 3. Invoice Detail Page Updates (`src/pages/InvoiceDetailPage.tsx`)
- **Rename** "Mark as Sent" to "Send Invoice to Client" — on click: save invoice data, POST to `N8N_BASE_URL/create-invoice` with `{ lead_id, invoice_id, line_items, service_date }`, update status to `sent`
- **Delete Invoice** button (red, destructive) — confirmation dialog "Delete invoice AC-XXXX? This cannot be undone." On confirm: DELETE from `invoices`, redirect to `/invoices`, success toast
- **Duplicate Invoice** button — query max invoice number, create new draft with copied line items and new number, redirect to new invoice
- **Preview** button — opens a Dialog/modal showing styled HTML invoice preview (indigo header with "Anytime Cleaners", bill-to, line items table, totals, footer)

### 4. Invoice List Page Updates (`src/pages/Invoices.tsx`)
- Add **status filter** dropdown (All / Draft / Sent / Paid / Overdue / Cancelled) above the table
- Add **Delete** button per row with confirmation dialog
- Update summary bar: 4 cards — Total Revenue (paid), Outstanding (sent+overdue), Overdue count (red if > 0), Draft count
- Add **Create Invoice** button that navigates to `/invoices/new` (no lead pre-selected, user picks from dropdown or leaves blank)

### 5. Route Registration (`src/App.tsx`)
- Add route for `/invoices/new` pointing to `NewInvoicePage`, protected for admin/manager

### 6. Item 5 (Overdue auto-detection)
- This is an n8n workflow change, not a frontend change. Will be skipped in this implementation — it's a server-side automation concern.

## Technical Details

**Files created:**
- `src/pages/NewInvoicePage.tsx` — full new invoice creation form

**Files modified:**
- `src/App.tsx` — add `/invoices/new` route (before `/invoices/:id` to avoid route conflict)
- `src/components/leads/LeadDetail.tsx` — replace Generate Invoice webhook with navigation
- `src/pages/InvoiceDetailPage.tsx` — add Send via n8n, Delete, Duplicate, Preview functionality
- `src/pages/Invoices.tsx` — add status filter, per-row delete, overdue count card

**Invoice number generation** (shared helper):
```typescript
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
```

**Preview modal** will render a styled div (not an iframe) with indigo header, company name, bill-to details, line items table, totals, and footer text — matching a professional invoice email template.

