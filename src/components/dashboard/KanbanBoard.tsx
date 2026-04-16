import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core';
import { supabase, N8N_BASE_URL } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Lead, LeadStage } from '@/types';
import KanbanColumn from './KanbanColumn';
import KanbanCard from './KanbanCard';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

const STAGES: LeadStage[] = ['new_lead', 'contacted', 'quote_sent', 'not_responding', 'booked', 'not_interested'];

interface KanbanBoardProps {
  fullHeight?: boolean;
}

export default function KanbanBoard({ fullHeight = false }: KanbanBoardProps) {
  const { role, teamMember } = useAuth();
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['kanban-leads'],
    queryFn: async () => {
      let query = supabase
        .from('leads')
        .select('*')
        .eq('is_archived', false)
        .order('updated_at', { ascending: false });

      if (role === 'agent' && teamMember) {
        query = query.eq('assigned_to', teamMember.id);
      }

      const { data: leadsData, error } = await query;
      if (error) throw error;

      // Fetch team members separately to avoid FK hint issues
      const assignedIds = [...new Set((leadsData ?? []).map((l) => l.assigned_to).filter(Boolean))];
      let membersMap: Record<string, any> = {};
      if (assignedIds.length > 0) {
        const { data: members } = await supabase
          .from('team_members')
          .select('*')
          .in('id', assignedIds);
        (members ?? []).forEach((m) => { membersMap[m.id] = m; });
      }

      return (leadsData ?? []).map((l) => ({
        ...l,
        assigned_member: l.assigned_to ? membersMap[l.assigned_to] ?? null : null,
      })) as Lead[];
    },
    refetchInterval: 30000,
  });

  const columns = useMemo(() => {
    const map: Record<LeadStage, Lead[]> = {
      new_lead: [], contacted: [], quote_sent: [], not_responding: [], booked: [], not_interested: [],
    };
    leads.forEach((l) => map[l.stage]?.push(l));
    return map;
  }, [leads]);

  const activeLead = activeId ? leads.find((l) => l.id === activeId) : null;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const lead = leads.find((l) => l.id === active.id);
    if (!lead) return;

    // Determine new stage: over.id is either a stage (column) or a lead id
    let newStage: LeadStage;
    if (STAGES.includes(over.id as LeadStage)) {
      newStage = over.id as LeadStage;
    } else {
      const overLead = leads.find((l) => l.id === over.id);
      newStage = overLead?.stage ?? lead.stage;
    }

    if (newStage === lead.stage) return;

    const oldStage = lead.stage;

    // Optimistic update
    queryClient.setQueryData<Lead[]>(['kanban-leads'], (old) =>
      old?.map((l) => (l.id === lead.id ? { ...l, stage: newStage } : l))
    );

    try {
      const { error } = await supabase
        .from('leads')
        .update({ stage: newStage, updated_at: new Date().toISOString() })
        .eq('id', lead.id);

      if (error) throw error;

      // Fire n8n webhook (fire-and-forget)
      const webhookPayload: Record<string, unknown> = {
        lead_id: lead.id,
        old_stage: oldStage,
        new_stage: newStage,
        lead_name: lead.full_name,
        changed_by: teamMember?.name ?? 'Unknown',
      };
      // Include extra fields for booked stage so booking confirmation email can use them
      if (newStage === 'booked') {
        webhookPayload.service_type = lead.service_type;
        webhookPayload.address = lead.address;
      }
      console.log('[stage-change webhook] payload:', webhookPayload);
      fetch(`${N8N_BASE_URL}/stage-change`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(webhookPayload),
      }).catch(() => {}); // silent fail for webhook

      toast.success(`Moved "${lead.full_name}" to ${newStage.replace(/_/g, ' ')}`);
      queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] });
      queryClient.invalidateQueries({ queryKey: ['not-responding-count'] });
    } catch {
      // Rollback
      queryClient.setQueryData<Lead[]>(['kanban-leads'], (old) =>
        old?.map((l) => (l.id === lead.id ? { ...l, stage: oldStage } : l))
      );
      toast.error('Failed to update lead stage');
    }
  };

  const wrapperClass = fullHeight
    ? 'flex gap-4 overflow-x-auto pb-2 h-full min-h-0'
    : 'flex gap-4 overflow-x-auto pb-4';

  if (isLoading) {
    return (
      <div className={wrapperClass}>
        {STAGES.map((s) => (
          <Skeleton key={s} className="min-w-[260px] h-96 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className={wrapperClass}>
        {STAGES.map((stage) => (
          <KanbanColumn key={stage} stage={stage} leads={columns[stage]} fullHeight={fullHeight} />
        ))}
      </div>
      <DragOverlay>
        {activeLead ? <KanbanCard lead={activeLead} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
