

# Anytime Cleaners CRM — Implementation Plan

## Overview
A full-featured CRM for a cleaning business built with React, Vite, TypeScript, Tailwind CSS, and Supabase. Role-based access (admin/manager/agent), lead management with Kanban, invoicing, team management, and n8n webhook integrations.

## Phase 1: Foundation
- **Supabase client setup** with environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
- **Auth system**: useAuth hook + AuthProvider exposing user, teamMember, role, loading. Login page at /login with Anytime Cleaners branding in indigo.
- **App layout**: Collapsible sidebar with role-filtered nav links (Dashboard, Leads, Team, Invoices, Admin). Top bar with page title, user name + role badge, notification bell (not_responding count), logout.
- **Route protection**: Redirect unauthenticated → /login, role-based route guards.

## Phase 2: Dashboard & Kanban
- **KPI cards** (admin/manager): Total Leads, Leads Today, Booked This Week, Revenue This Month
- **Kanban board** with 5 columns (New Lead → Contacted → Not Responding → Booked → Not Interested) using @dnd-kit. Drag-drop updates stage in Supabase + POSTs to n8n /stage-change webhook.
- Agent view: filtered to assigned leads only, no KPIs.

## Phase 3: Lead Management
- **Leads list** (/leads): Filterable/searchable table with stage, source, agent filters. Role-scoped data.
- **Lead detail** (/leads/:id): Two-column layout — editable fields (left), quick actions + invoices (right, admin/manager only). Timeline of lead_updates with type badges. Agent restrictions enforced.
- **New lead form** (/leads/new): POST to n8n /new-lead webhook on submit.

## Phase 4: Team Management
- **/team**: Table of team members with lead counts. Admin can add/edit members (creates Supabase Auth user + team_member row). Manager view-only. Bar chart via Recharts showing leads per member.

## Phase 5: Invoices
- **/invoices**: Table with status badges (Draft/Sent/Paid/Overdue/Cancelled). Invoice detail with editable line items, auto-calculated subtotal/GST/total. Save Draft, Mark Sent, Mark Paid actions.

## Phase 6: Admin Settings
- **/admin**: Read/write admin_config grouped into Messaging, Company, Automation sections. SMS template live preview. Notification recipients management with toggle controls.

## Design System
- Primary indigo (#4F46E5), white cards with subtle shadows, fully responsive
- Stage badge colors: New=blue, Contacted=yellow, Not Responding=orange, Booked=green, Not Interested=red
- Sonner toasts, loading spinners, empty states throughout

## Technical Stack
- react-router-dom for routing
- @tanstack/react-query for data fetching
- @dnd-kit/core + @dnd-kit/sortable for Kanban
- Recharts for charts
- Sonner for toasts
- No Lovable-specific dependencies — clean npm build output for Nginx deployment

## Database
- Supabase tables with RLS policies enforced via anon key
- Tables: leads, team_members, lead_updates, invoices, admin_config, notification_recipients, capi_log

