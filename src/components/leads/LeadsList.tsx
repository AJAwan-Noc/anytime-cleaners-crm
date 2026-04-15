import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Lead, TeamMember, LeadStage, LeadSource, STAGE_LABELS, STAGE_COLORS } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
  const { role, teamMember } = useAuth();
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [agentFilter, setAgentFilter] = useState<string>('all');

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

  const filtered = leads.filter((lead) => {
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
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Leads</h1>
        <Button onClick={() => navigate('/leads/new')}>
          <Plus className="h-4 w-4 mr-1" /> New Lead
        </Button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search name or phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="w-[160px]">
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
          <SelectTrigger className="w-[160px]">
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
            <SelectTrigger className="w-[180px]">
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
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Assigned</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((lead) => (
                <TableRow
                  key={lead.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/leads/${lead.id}`)}
                >
                  <TableCell className="font-medium">{lead.full_name}</TableCell>
                  <TableCell>{lead.phone}</TableCell>
                  <TableCell>{lead.service_type}</TableCell>
                  <TableCell className="capitalize">{lead.source}</TableCell>
                  <TableCell>
                    <Badge className={STAGE_COLORS[lead.stage]} variant="secondary">
                      {STAGE_LABELS[lead.stage]}
                    </Badge>
                  </TableCell>
                  <TableCell>{lead.assigned_member?.name ?? '—'}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(lead.created_at), 'MMM d, yyyy')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
