import { supabase } from './supabase';

export type ActivityEvent =
  | 'lead_created'
  | 'lead_stage_changed'
  | 'note_added'
  | 'invoice_created'
  | 'invoice_paid'
  | 'team_member_created'
  | 'team_member_deleted'
  | 'job_created'
  | 'job_started'
  | 'job_completed';

export async function logActivity(params: {
  event_type: ActivityEvent;
  actor_id?: string | null;
  actor_name?: string | null;
  entity_type?: string;
  entity_id?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await supabase.from('activity_log').insert({
      event_type: params.event_type,
      actor_id: params.actor_id ?? null,
      actor_name: params.actor_name ?? null,
      entity_type: params.entity_type ?? null,
      entity_id: params.entity_id ?? null,
      description: params.description ?? null,
      metadata: params.metadata ?? null,
    });
  } catch (e) {
    console.error('Failed to log activity', e);
  }
}
