import { TeamMember } from '@/types';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Archive, Loader2, X } from 'lucide-react';

interface LeadsBulkActionBarProps {
  selectedCount: number;
  members: TeamMember[];
  assignTo: string;
  onAssignToChange: (id: string) => void;
  onApplyAssignment: () => void;
  onArchive: () => void;
  onClear: () => void;
  loading?: 'assign' | 'archive' | null;
}

export default function LeadsBulkActionBar({
  selectedCount, members, assignTo, onAssignToChange,
  onApplyAssignment, onArchive, onClear, loading,
}: LeadsBulkActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 animate-in slide-in-from-bottom-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-lg">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onClear}
            aria-label="Clear selection"
          >
            <X className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium">
            {selectedCount} selected
          </span>
        </div>

        <div className="h-6 w-px bg-border" />

        <Select value={assignTo} onValueChange={onAssignToChange}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Assign to…" />
          </SelectTrigger>
          <SelectContent>
            {members.map((m) => (
              <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          onClick={onApplyAssignment}
          disabled={!assignTo || !!loading}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {loading === 'assign' && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
          Apply Assignment
        </Button>

        <Button
          variant="destructive"
          onClick={onArchive}
          disabled={!!loading}
        >
          {loading === 'archive' ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <Archive className="mr-1 h-4 w-4" />
          )}
          Archive Selected
        </Button>
      </div>
    </div>
  );
}
