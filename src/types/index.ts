export type Role = 'owner' | 'admin' | 'manager' | 'agent' | 'cleaner' | 'client';

export type JobStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

export interface Job {
  id: string;
  lead_id: string;
  assigned_to: string | null;
  scheduled_date: string;
  scheduled_time: string;
  estimated_duration_hours: number | null;
  status: JobStatus;
  notes: string | null;
  is_recurring: boolean;
  recurring_schedule_id?: string | null;
  service_type: string | null;
  created_at: string;
  updated_at: string;
  lead?: { id: string; full_name: string; address: string | null; email: string | null; phone: string };
  assigned_member?: { id: string; name: string };
}

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  scheduled: 'Scheduled',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const JOB_STATUS_COLORS: Record<JobStatus, string> = {
  scheduled: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-amber-100 text-amber-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

export const JOB_STATUS_HEX: Record<JobStatus, string> = {
  scheduled: '#3b82f6',
  in_progress: '#f59e0b',
  completed: '#22c55e',
  cancelled: '#ef4444',
};

export type ScheduleType =
  | 'weekly'
  | 'fortnightly'
  | 'monthly'
  | 'quarterly'
  | 'every_x_days'
  | 'specific_weekdays'
  | 'nth_weekday'
  | 'specific_dates';

export interface RecurringSchedule {
  id: string;
  lead_id: string;
  schedule_type: ScheduleType;
  config: Record<string, unknown>;
  start_date: string | null;
  end_date: string | null;
  scheduled_time: string;
  estimated_duration_hours: number | null;
  assigned_to: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ActivityLog {
  id: string;
  event_type: string;
  actor_id: string | null;
  actor_name: string | null;
  entity_type: string | null;
  entity_id: string | null;
  description: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export type LeadStage = 'new_lead' | 'contacted' | 'quote_sent' | 'not_responding' | 'booked' | 'not_interested';

export type LeadSource = 'website' | 'facebook' | 'instagram' | 'referral' | 'google' | 'manual' | 'other';

export type ServiceType = 'Regular Cleaning' | 'Deep Clean' | 'Move-In-Out' | 'Commercial' | 'Window Cleaning' | 'Other';

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';

export type UpdateType = 'Note' | 'Call' | 'Email' | 'SMS' | 'Stage Change' | 'System';

export type PropertyType = 'residential' | 'commercial' | 'industrial' | 'other';

export interface Property {
  id: string;
  lead_id: string;
  address: string;
  property_type: PropertyType;
  bedrooms: number | null;
  bathrooms: number | null;
  square_metres: number | null;
  access_code: string | null;
  parking_notes: string | null;
  special_instructions: string | null;
  preferred_products: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // joined
  lead?: Pick<Lead, 'id' | 'full_name'>;
}

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  residential: 'Residential',
  commercial: 'Commercial',
  industrial: 'Industrial',
  other: 'Other',
};

export const PROPERTY_TYPE_COLORS: Record<PropertyType, string> = {
  residential: 'bg-blue-100 text-blue-800',
  commercial: 'bg-purple-100 text-purple-800',
  industrial: 'bg-amber-100 text-amber-800',
  other: 'bg-gray-100 text-gray-800',
};

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  is_active: boolean;
  user_id: string;
  created_at: string;
}

export interface Lead {
  id: string;
  full_name: string;
  email: string | null;
  phone: string;
  source: LeadSource;
  stage: LeadStage;
  service_type: string;
  address: string | null;
  notes: string | null;
  assigned_to: string | null;
  meta_lead_id: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  // joined
  assigned_member?: TeamMember;
}

export interface LeadUpdate {
  id: string;
  lead_id: string;
  author_id: string | null;
  author_name: string;
  message: string;
  update_type: UpdateType;
  created_at: string;
}

export interface LineItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface Invoice {
  id: string;
  lead_id: string;
  invoice_number: string;
  service_date: string;
  line_items: LineItem[];
  subtotal: number;
  tax_rate: number;
  total: number;
  status: InvoiceStatus;
  notes: string | null;
  paid_at: string | null;
  payment_method: string | null;
  created_at: string;
  // joined
  lead?: Lead;
}

export interface AdminConfig {
  key: string;
  value: string;
  description: string | null;
  updated_at: string;
}

export interface NotificationRecipient {
  id: string;
  name: string;
  email: string;
  is_active: boolean;
  notify_new_lead: boolean;
  notify_stage_change: boolean;
  notify_invoice: boolean;
  created_at: string;
}

export interface CAPILog {
  id: string;
  lead_id: string;
  event_name: string;
  stage: string;
  sent_to_meta: boolean;
  payload: Record<string, unknown>;
  created_at: string;
}

export const STAGE_LABELS: Record<LeadStage, string> = {
  new_lead: 'New Lead',
  contacted: 'Contacted',
  quote_sent: 'Quote Sent',
  not_responding: 'Not Responding',
  booked: 'Booked',
  not_interested: 'Not Interested',
};

export const STAGE_COLORS: Record<LeadStage, string> = {
  new_lead: 'bg-blue-100 text-blue-800',
  contacted: 'bg-yellow-100 text-yellow-800',
  quote_sent: 'bg-amber-100 text-amber-800',
  not_responding: 'bg-orange-100 text-orange-800',
  booked: 'bg-green-100 text-green-800',
  not_interested: 'bg-red-100 text-red-800',
};

export const INVOICE_STATUS_COLORS: Record<InvoiceStatus, string> = {
  draft: 'bg-gray-100 text-gray-800',
  sent: 'bg-blue-100 text-blue-800',
  paid: 'bg-green-100 text-green-800',
  overdue: 'bg-red-100 text-red-800',
  cancelled: 'bg-orange-100 text-orange-800',
};

export const UPDATE_TYPE_COLORS: Record<UpdateType, string> = {
  Note: 'bg-gray-100 text-gray-700',
  Call: 'bg-blue-100 text-blue-700',
  Email: 'bg-purple-100 text-purple-700',
  SMS: 'bg-teal-100 text-teal-700',
  'Stage Change': 'bg-yellow-100 text-yellow-700',
  System: 'bg-red-100 text-red-700',
};
