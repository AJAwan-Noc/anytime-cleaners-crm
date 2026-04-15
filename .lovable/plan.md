

# Phase 4: Team Management

## Overview
Replace the placeholder `/team` page with a full team management view. Admin gets full CRUD, manager gets read-only, agent is already redirected by `ProtectedRoute`.

## Files to Create/Edit

### 1. `src/pages/Team.tsx` — Full rewrite
- Fetch all `team_members` from Supabase
- Fetch lead counts per member: `leads` table grouped by `assigned_to` where `is_archived = false`
- Role-aware rendering using `useAuth().role`

**Admin view:**
- "Add New Member" button opening a Dialog modal
- Table with columns: Name, Email, Phone, Role badge (admin=indigo, manager=blue, agent=gray), Active toggle (Switch component), Leads Assigned count, Edit button
- Active toggle calls `supabase.from('team_members').update({ is_active })` on click
- Add modal fields: Name (required), Email (required), Phone, Role dropdown
- On submit: `supabase.auth.signUp({ email, password: 'Welcome123!' })` → then `supabase.from('team_members').insert({ user_id, name, email, phone, role, is_active: true })`
- Edit button opens same modal pre-filled, saves via `.update()`
- Below table: Recharts `BarChart` with member names on X-axis, lead counts on Y-axis

**Manager view:**
- Same table but no Add button, no Edit buttons, Active column shows badge instead of toggle
- Same bar chart

### 2. No routing changes needed
The `/team` route already exists with `allowedRoles={['admin', 'manager']}`, which blocks agents.

## Technical Details
- Use `@tanstack/react-query` for data fetching (consistent with existing patterns)
- Use existing UI components: `Table`, `Dialog`, `Button`, `Badge`, `Switch`, `Select`, `Input`, `Label`
- Use `ChartContainer` from `src/components/ui/chart.tsx` with Recharts `BarChart`, `Bar`, `XAxis`, `YAxis`, `Tooltip`
- Role badge colors: `bg-indigo-100 text-indigo-800` (admin), `bg-blue-100 text-blue-800` (manager), `bg-gray-100 text-gray-800` (agent)
- Sonner toasts for success/error feedback
- Invalidate `team-members` query after add/edit/toggle mutations

## Important Notes
- `supabase.auth.signUp` from the client uses the anon key — this will create the auth user but may send a confirmation email depending on Supabase settings. The team_members row insert happens immediately after.
- The edit modal will NOT change auth credentials (email/password), only the `team_members` table fields.

