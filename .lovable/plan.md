
The user has refined three details of the previously approved Client Account System plan. Updating the plan accordingly.

## Client Account System — Revised Plan

### 1. Types — `src/types/index.ts`
Add `lead_id?: string | null` to `TeamMember` interface.

### 2. Auth Context — `src/contexts/AuthContext.tsx`
Current query uses `.select('*')` which should already return `lead_id`, but to be explicit and safe, change to an explicit field list including `lead_id`:
```
.select('id, user_id, name, email, phone, role, cleaner_type, total_jobs_completed, avg_rating, lead_id, created_at')
```
This guarantees `teamMember.lead_id` is populated for the portal logic.

### 3. Team Page — `src/pages/Team.tsx`

**Add Member Modal — Client mode:**
- Extend form state with `lead_id: string | null`.
- When `form.role === 'client'` (create mode): hide Name / Email / Phone inputs; render a **Lead Search** combobox (shadcn `Command` + `Popover`).
  - Query `leads` by `full_name` or `email` (ilike, limit 20).
  - Pre-fetch existing client `team_members` rows and exclude their `lead_id`s from results.
  - On select: auto-fill `name`, `email`, `phone`, store `lead_id`. Show read-only summary card with a "Change" action.
- Submit: include `lead_id` in webhook body to `/create-team-member`. Validate a lead is selected when role=client.

**Team Table — Client rows:**
- Render client name as `<Link to={`/leads/${m.lead_id}`}>`.
- Hide stats button for clients. Edit pencil for clients also routes to `/leads/:lead_id` instead of opening the modal.

### 4. Portal Page — `src/pages/ClientPortal.tsx`
- Use `teamMember.lead_id` from `useAuth()` (no email-based lookup, no `client-leads` query).
- If `lead_id` missing/null: render single centered Card — "Your account is being set up. Please contact us if you need assistance." with hardcoded contact:
  - Email: `info@anytimecleaners.com.au` (mailto link)
  - Phone: `1300 000 000` (tel link)
  - No `admin_config` query.
- If `lead_id` present: query jobs/invoices/feedback with `.eq('lead_id', leadId)` (single id). Use the leads row for that id to get address for booking dialog defaults.

### 5. Route Guards
- `ProtectedRoute.tsx`: when a `client` is denied a non-portal route, redirect to `/portal` instead of `/` (avoids loop). Logic: `if (role === 'client') return <Navigate to="/portal" replace />;` else `<Navigate to="/" replace />`.
- `App.tsx`: add `allowedRoles={['owner','admin','manager','agent','cleaner']}` to internal routes that currently lack it: `/` (Dashboard), `/pipeline`, `/leads`, `/leads/new`, `/leads/:id`. **Do NOT add allowedRoles to `/profile`** — it stays open to all authenticated roles including clients.
- `Login.tsx`: no change (client → /portal already correct).

### Files modified
- `src/types/index.ts`
- `src/contexts/AuthContext.tsx` (explicit field list incl. lead_id)
- `src/pages/Team.tsx` (Lead Search combobox + client-row link)
- `src/pages/ClientPortal.tsx` (use teamMember.lead_id + hardcoded contacts)
- `src/components/ProtectedRoute.tsx` (client → /portal redirect)
- `src/App.tsx` (add allowedRoles to internal routes, leave /profile open)

No new files. No DB migration.
