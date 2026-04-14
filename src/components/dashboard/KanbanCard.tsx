import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Lead, STAGE_LABELS, STAGE_COLORS } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Phone, User } from 'lucide-react';

interface KanbanCardProps {
  lead: Lead;
}

export default function KanbanCard({ lead }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lead.id,
    data: { lead },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-card border rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing"
    >
      <div className="flex items-center justify-between mb-2">
        <p className="font-medium text-sm truncate">{lead.full_name}</p>
        <Badge className={`${STAGE_COLORS[lead.stage]} text-[10px] px-1.5 py-0 border-0`}>
          {STAGE_LABELS[lead.stage]}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground mb-1">{lead.service_type}</p>
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Phone className="h-3 w-3" />
        <span>{lead.phone}</span>
      </div>
      {lead.assigned_member && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
          <User className="h-3 w-3" />
          <span>{lead.assigned_member.name}</span>
        </div>
      )}
    </div>
  );
}
