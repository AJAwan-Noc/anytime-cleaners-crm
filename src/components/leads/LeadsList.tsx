import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Lead, TeamMember, LeadStage, LeadSource, STAGE_LABELS, STAGE_COLORS } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Search, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import LeadsBulkActionBar from './LeadsBulkActionBar';

const SOURCE_LABELS: Record<LeadSource, string> = {
  website: 'Website',
  facebook: 'Facebook',
  instagram: 'Instagram',
  referral: 'Referral',
  google: 'Google',
  manual: 'Manual',
  other: 'Other',
};

export default function LeadsList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { role, teamMember } = useAuth();
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [agentFilter, setAgentFilter] = useState<string>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAssignTo, setBulkAssignTo] = useState<string>('');
  const [bulkLoading, setBulkLoading] = useState<'assign' | 'archive' | null>(null);

  const canBulk = role === 'owner' || role === 'admin' || role === 'manager';

  const { data: members = [] } = useQuery({
    queryKey: ['team-members-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_members')
        .select('*')
        .eq('is_active', true);
      if (error) throw error;
      return data as TeamMember[];
    },
  });

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['leads-list'],
    queryFn: async () => {
      let query = supabase
        .from('leads')
        .select('*')
        .eq('is_archived', false)
        .order('created_at', { ascending: false });

      if (role === 'agent' && teamMember) {
        query = query.eq('assigned_to', teamMember.id);
      }

      const { data, error } = await query;
      if (error) throw error;

      const assignedIds = [...new Set((data || []).map((l: Lead) => l.assigned_to).filter(Boolean))] as string[];
      let membersMap: Record<string, TeamMember> = {};
      if (assignedIds.length > 0) {
        const { data: mData } = await supabase.from('team_members').select('*').in('id', assignedIds);
        if (mData) {
          membersMap = Object.fromEntries(mData.map((m: TeamMember) => [m.id, m]));
        }
      }

      return (data || []).map((l: Lead) => ({
        ...l,
        assigned_member: l.assigned_to ? membersMap[l.assigned_to] : undefined,
      })) as Lead[];
    },
  });

  const filtered = useMemo(() => leads.filter((lead) => {
    if (stageFilter !== 'all' && lead.stage !== stageFilter) return false;
    if (sourceFilter !== 'all' && lead.source !== sourceFilter) return false;
    if (agentFilter !== 'all' && lead.assigned_to !== agentFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !lead.full_name.toLowerCase().includes(q) &&
        !lead.phone.toLowerCase().includes(q)
      )
        return false;
    }
    return true;
  }), [leads, stageFilter, sourceFilter, agentFilter, search]);

  const allFilteredSelected = filtered.length > 0 && filtered.every((l) => selected.has(l.id));
  const someFilteredSelected = filtered.some((l) => selected.has(l.id));

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filtered.forEach((l) => next.delete(l.id));
      } else {
        filtered.forEach((l) => next.add(l.id));
      }
      return next;
    });
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => {
    setSelected(new Set());
    setBulkAssignTo('');
  };

  const handleApplyAssignment = async () => {
    if (!bulkAssignTo || selected.size === 0) return;
    setBulkLoading('assign');
    try {
      const ids = Array.from(selected);
      const { error } = await supabase
        .from('leads')
        .update({ assigned_to: bulkAssignTo })
        .in('id', ids);
      if (error) throw error;
      toast.success(`Assigned ${ids.length} lead${ids.length > 1 ? 's' : ''}`);
      clearSelection();
      queryClient.invalidateQueries({ queryKey: ['leads-list'] });
      queryClient.invalidateQueries({ queryKey: ['kanban-leads'] });
    } catch (err: any) {
      toast.error(err.message || 'Failed to assign leads');
    } finally {
      setBulkLoading(null);
    }
  };

  const handleArchive = async () => {
    if (selected.size === 0) return;
    setBulkLoading('archive');
    try {
      const ids = Array.from(selected);
      const { error } = await supabase
        .from('leads')
        .update({ is_archived: true })
        .in('id', ids);
      if (error) throw error;
      toast.success(`Archived ${ids.length} lead${ids.length > 1 ? 's' : ''}`);
      clearSelection();
      queryClient.invalidateQueries({ queryKey: ['leads-list'] });
      queryClient.invalidateQueries({ queryKey: ['kanban-leads'] });
    } catch (err: any) {
      toast.error(err.message || 'Failed to archive leads');
    } finally {
      setBulkLoading(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-foreground">Leads</h1>
        <Button onClick={() => navigate('/leads/new')} size="sm" className="sm:size-default">
          <Plus className="h-4 w-4 mr-1" /> New Lead
        </Button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <div className="relative w-full sm:flex-1 sm:min-w-[200px] sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search name or phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="Stage" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stages</SelectItem>
            {(Object.keys(STAGE_LABELS) as LeadStage[]).map((s) => (
              <SelectItem key={s} value={s}>{STAGE_LABELS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            {(Object.keys(SOURCE_LABELS) as LeadSource[]).map((s) => (
              <SelectItem key={s} value={s}>{SOURCE_LABELS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {role !== 'agent' && (
          <Select value={agentFilter} onValueChange={setAgentFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Agent" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Agents</SelectItem>
              {members.map((m) => (
                <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center py-12 text-muted-foreground">No leads found.</p>
      ) : (
        <div className="rounded-lg border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {canBulk && (
                  <TableHead className="w-[40px]">
                    <Checkbox
                      checked={allFilteredSelected ? true : someFilteredSelected ? 'indeterminate' : false}
                      onCheckedChange={toggleAll}
                      aria-label="Select all"
                    />
                  </TableHead>
                )}
                <TableHead>Name</TableHead>
                <TableHead className="hidden md:table-cell">Phone</TableHead>
                <TableHead className="hidden lg:table-cell">Service</TableHead>
                <TableHead className="hidden lg:table-cell">Source</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead className="hidden md:table-cell">Assigned</TableHead>
                <TableHead className="hidden xl:table-cell">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((lead) => (
                <TableRow
                  key={lead.id}
                  data-state={selected.has(lead.id) ? 'selected' : undefined}
                  className="cursor-pointer"
                  onClick={() => navigate(`/leads/${lead.id}`)}
                >
                  {canBulk && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selected.has(lead.id)}
                        onCheckedChange={() => toggleOne(lead.id)}
                        aria-label={`Select ${lead.full_name}`}
                      />
                    </TableCell>
                  )}
                  <TableCell className="font-medium max-w-[200px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="truncate">{lead.full_name}</span>
                      {lead.notes?.startsWith('CLIENT PORTAL REQUEST:') && (
                        <Badge variant="outline" className="text-xs border-primary/40 text-primary">Portal</Badge>
                      )}
                    </div>
                    <div className="md:hidden text-xs text-muted-foreground mt-0.5">{lead.phone}</div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell whitespace-nowrap">{lead.phone}</TableCell>
                  <TableCell className="hidden lg:table-cell">{lead.service_type}</TableCell>
                  <TableCell className="hidden lg:table-cell capitalize">{lead.source}</TableCell>
                  <TableCell>
                    <Badge className={STAGE_COLORS[lead.stage]} variant="secondary">
                      {STAGE_LABELS[lead.stage]}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{lead.assigned_member?.name ?? '—'}</TableCell>
                  <TableCell className="hidden xl:table-cell text-muted-foreground whitespace-nowrap">
                    {format(new Date(lead.created_at), 'MMM d, yyyy')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {canBulk && (
        <LeadsBulkActionBar
          selectedCount={selected.size}
          members={members}
          assignTo={bulkAssignTo}
          onAssignToChange={setBulkAssignTo}
          onApplyAssignment={handleApplyAssignment}
          onArchive={handleArchive}
          onClear={clearSelection}
          loading={bulkLoading}
        />
      )}
    </div>
  );
}
