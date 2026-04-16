

## Plan: Email Toggles + Email Template Builder

### Part 1 — Email Notifications Toggle Section (AdminSettings.tsx)

Add a new card section below Notification Recipients with 7 toggle switches. Each toggle reads/writes to `admin_config` using the existing `configMap` pattern.

Toggle keys and descriptions:
- `email_welcome_enabled` — "Send welcome email to new leads"
- `email_team_alert_enabled` — "Alert team members of new leads"
- `email_stage_alert_enabled` — "Notify on lead stage changes"
- `email_followup_enabled` — "Send automatic follow-up reminders"
- `email_booking_confirmation_enabled` — "Send booking confirmation to clients"
- `email_invoice_enabled` — "Send invoice emails to clients"
- `email_report_enabled` — "Send periodic AI summary reports"

Each toggle auto-saves via upsert on change with a brief check/success indicator (no Save button).

### Part 2 — Email Template Builder

**Files to create/modify:**

1. **`src/pages/EmailTemplates.tsx`** — List page showing `email_templates` rows as cards (name, subject, updated_at, Edit button linking to `/admin/email-templates/:template_key`).

2. **`src/pages/EmailTemplateEditor.tsx`** — Full-page split editor:
   - Left (60%): subject input, header color picker, logo URL input + preview, Quill.js WYSIWYG body editor (loaded via CDN script tag), footer text input, variable chips panel that insert at cursor
   - Right (40%): Live preview div rendering header color bar, logo, body HTML with variables replaced by sample data, footer
   - Save button (upserts to `email_templates`), Test Email button (POST to `N8N_BASE_URL/test-email`)
   - Sample data map: `{name}=John Smith, {service}=Deep Clean, {phone}=+61412345678, {address}=42 George St Sydney, {invoice_number}=AC-0001, {new_stage}=Booked, {old_stage}=Contacted, {changed_by}=AJ, {report}=Sample AI report text`

3. **`src/components/AppSidebar.tsx`** — Add "Email Templates" nav item at `/admin/email-templates`, visible to owner/admin only, using `Mail` icon from lucide.

4. **`src/App.tsx`** — Add two protected routes under the AppLayout:
   - `/admin/email-templates` → `EmailTemplates`
   - `/admin/email-templates/:template_key` → `EmailTemplateEditor`
   Both wrapped in `ProtectedRoute allowedRoles={['owner', 'admin']}`.

5. **`index.html`** — Add Quill.js CDN (CSS + JS) in `<head>` for the WYSIWYG editor.

### Technical Details

- Quill loaded via CDN (`<link>` for snow theme CSS, `<script>` for quill.js). Editor initialized in a `useEffect` with a ref. Variable chip click calls `quill.insertText(quill.getSelection().index, '{variable}')`.
- Live preview uses `dangerouslySetInnerHTML` with variables replaced by sample data, wrapped in a styled container with dynamic header color and logo.
- Template row expected schema: `template_key` (PK), `name`, `subject`, `header_color`, `logo_url`, `body_html`, `footer_text`, `variables` (jsonb array of variable names), `updated_at`.

