
Migration is already applied. Proceeding with the 10 code fixes exactly as outlined previously, with one correction: any RLS-related code or comments will reference `get_my_role_safe()` rather than `has_role()` (only relevant if I touch policies — I won't, since the table + policies already exist).

## Implementation order

**1. Types update** — `src/types/index.ts`
- Extend `Property` with `custom_fields: {name:string;value:string}[]`, `floor_level`, `business_name`, `hazard_notes`.
- Extend `RecurringSchedule` with `day_schedules?: {day:string;time:string}[]`.
- Extend `TeamMember` with `cleaner_type?: 'residential'|'commercial'|'specialist'|'general'`.
- Add `ServiceType` interface.

**2. Shared recurring component** — new `src/components/recurring/RecurringScheduleFields.tsx`
- Extract all 8 schedule-type UI from `RecurringSchedulePanel`. Controlled props: value/onChange.
- For `specific_weekdays`: per-day time picker list backed by `day_schedules`.

**3. Calendar Create Job recurring** — `src/pages/Calendar.tsx`
- When `is_recurring` toggle on → render `<RecurringScheduleFields>`.
- On save: insert `recurring_schedules` first, then job with `recurring_schedule_id`.
- Webhook payload includes `created_by_id: teamMember?.id` (Fix 9).

**4. RecurringSchedulePanel** — `src/components/leads/RecurringSchedulePanel.tsx`
- Swap inline fields for shared `<RecurringScheduleFields>`.
- Update `computeNextDate` to use per-day `day_schedules` when type=specific_weekdays.
- Include `created_by_id` in any job-assigned webhook posts.

**5. Property dialog dynamic + custom fields** — `src/components/properties/PropertyFormDialog.tsx`
- Conditional field groups by `property_type` per spec.
- "Custom Fields" section: array of `{name,value}` with Add/Remove buttons → saved to `custom_fields` JSONB.

**6. Property panel display** — `src/components/properties/LeadPropertiesPanel.tsx` and `src/pages/PropertyDetailPage.tsx`
- Render the new typed fields and custom fields list.

**7. Cleaner Performance** — new `src/components/dashboard/CleanerPerformance.tsx` + `src/pages/Dashboard.tsx`
- Admin/manager only. Table: name, cleaner_type, total jobs done, jobs this month, avg rating. Show `—` for empties.

**8. Team stats** — new `src/components/team/MemberStatsDialog.tsx` + `src/pages/Team.tsx`
- "View Stats" per row → modal with completed jobs, jobs this month, avg rating, agent stage breakdown (Recharts bar).
- Add `cleaner_type` Select in Team add/edit form (visible when role=cleaner).

**9. Service types** — new `src/components/leads/ServiceTypeCombobox.tsx` + `src/components/admin/ServiceTypesSection.tsx`
- Combobox queries `service_types` (active, sort_order). Allows custom typed value; on save inserts new row.
- Used in `LeadDetail.tsx` and `NewLeadForm.tsx`.
- AdminSettings new section: list with inline rename, drag-reorder via `@dnd-kit`, active toggle, delete confirm.

**10. AdminSettings rename + cleanup** — `src/pages/AdminSettings.tsx`
- "Messaging" → "Default Message Templates" + grey description.
- "Automation" → "Automation Rules" + grey description + green "Active" badge.
- Company section: remove `company_name` and `invoice_prefix` inputs and from save payload. Keep tax rate. Add grey note about contacting support.

## Files
Modified: `src/types/index.ts`, `src/pages/Calendar.tsx`, `src/pages/Dashboard.tsx`, `src/pages/Team.tsx`, `src/pages/AdminSettings.tsx`, `src/pages/PropertyDetailPage.tsx`, `src/components/leads/LeadDetail.tsx`, `src/components/leads/NewLeadForm.tsx`, `src/components/leads/RecurringSchedulePanel.tsx`, `src/components/properties/PropertyFormDialog.tsx`, `src/components/properties/LeadPropertiesPanel.tsx`

New: `src/components/recurring/RecurringScheduleFields.tsx`, `src/components/dashboard/CleanerPerformance.tsx`, `src/components/team/MemberStatsDialog.tsx`, `src/components/admin/ServiceTypesSection.tsx`, `src/components/leads/ServiceTypeCombobox.tsx`

Approve to implement.
