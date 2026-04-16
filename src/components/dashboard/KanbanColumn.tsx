import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Lead, LeadStage, STAGE_LABELS } from '@/types';
import KanbanCard from './KanbanCard';

const COLUMN_HEADER_COLORS: Record<LeadStage, string> = {
  new_lead: 'bg-blue-500',
  contacted: 'bg-yellow-500',
  quote_sent: 'bg-amber-500',
  not_responding: 'bg-orange-500',
  booked: 'bg-green-500',
  not_interested: 'bg-red-500',
};

interface KanbanColumnProps {
  stage: LeadStage;
  leads: Lead[];
  fullHeight?: boolean;
}

export default function KanbanColumn({ stage, leads, fullHeight = false }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col min-w-[260px] w-[260px] rounded-lg border bg-muted/50 transition-colors ${fullHeight ? 'h-full min-h-0' : ''} ${isOver ? 'ring-2 ring-primary/40' : ''}`}
    >
      <div className="flex items-center gap-2 p-3 border-b">
        <div className={`w-2.5 h-2.5 rounded-full ${COLUMN_HEADER_COLORS[stage]}`} />
        <h3 className="font-semibold text-sm">{STAGE_LABELS[stage]}</h3>
        <span className="ml-auto text-xs text-muted-foreground bg-background rounded-full px-2 py-0.5">
          {leads.length}
        </span>
      </div>
      <div className={`flex-1 p-2 space-y-2 overflow-y-auto ${fullHeight ? 'min-h-0' : 'max-h-[calc(100vh-320px)]'}`}>
        <SortableContext items={leads.map((l) => l.id)} strategy={verticalListSortingStrategy}>
          {leads.map((lead) => (
            <KanbanCard key={lead.id} lead={lead} />
          ))}
        </SortableContext>
        {leads.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-8">No leads</p>
        )}
      </div>
    </div>
  );
}
