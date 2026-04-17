import { supabase } from './supabase';

export type ActivityEvent =
  | 'lead_created'
  | 'lead_updated'
  | 'lead_archived'
  | 'lead_stage_changed'
  | 'note_added'
  | 'invoice_created'
  | 'invoice_sent'
  | 'invoice_paid'
  | 'team_member_created'
  | 'team_member_deleted'
  | 'job_created'
  | 'job_started'
  | 'job_completed'
  | 'job_cancelled'
  | 'feedback_received'
  | 'report_generated'
  | 'recurring_schedule_created';

export async function logActivity(params: {
  event_type: ActivityEvent;
  actor_id?: string | null;
  actor_name?: string | null;
  entity_type?: string;
  entity_id?: string;
  entity_name?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    // actor_name and entity_type are NOT NULL in DB — provide sensible defaults
    const actorName = params.actor_name?.trim() || 'System';
    const { error } = await supabase.from('activity_log').insert({
      event_type: params.event_type,
      actor_id: params.actor_id ?? null,
      actor_name: actorName,
      entity_type: params.entity_type ?? 'unknown',
      entity_id: params.entity_id ?? null,
      entity_name: params.entity_name ?? null,
      description: params.description ?? params.event_type,
      metadata: params.metadata ?? null,
    });
    if (error) console.error('activity_log insert failed', error);
  } catch (e) {
    console.error('Failed to log activity', e);
  }
}
