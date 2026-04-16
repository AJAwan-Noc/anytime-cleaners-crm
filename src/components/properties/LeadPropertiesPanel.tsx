import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Property, PROPERTY_TYPE_COLORS } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Plus, Pencil, Trash2, ChevronDown, Bed, Bath, Ruler, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import PropertyFormDialog from './PropertyFormDialog';

interface Props {
  leadId: string;
  leadAddress?: string | null;
}

export default function LeadPropertiesPanel({ leadId, leadAddress }: Props) {
  const qc = useQueryClient();
  const { role } = useAuth();
  const canEdit = role === 'owner' || role === 'admin' || role === 'manager';

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Property | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data: properties = [], isLoading } = useQuery({
    queryKey: ['lead-properties', leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Property[];
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('properties').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lead-properties', leadId] });
      qc.invalidateQueries({ queryKey: ['properties-all'] });
    },
    onError: () => toast.error('Failed to update'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('properties').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Property deleted');
      setDeleteId(null);
      qc.invalidateQueries({ queryKey: ['lead-properties', leadId] });
      qc.invalidateQueries({ queryKey: ['properties-all'] });
    },
    onError: () => toast.error('Failed to delete'),
  });

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openAdd = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (p: Property) => { setEditing(p); setDialogOpen(true); };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Properties</CardTitle>
          {canEdit && (
            <Button size="sm" variant="outline" onClick={openAdd} className="gap-1">
              <Plus className="h-4 w-4" /> Add
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading && (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {!isLoading && properties.length === 0 && (
            <p className="text-sm text-muted-foreground">No properties added yet.</p>
          )}
          {properties.map((p) => {
            const isOpen = expanded.has(p.id);
            return (
              <Collapsible
                key={p.id}
                open={isOpen}
                onOpenChange={() => toggleExpand(p.id)}
                className="border rounded-md"
              >
                <div className="p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <CollapsibleTrigger className="flex-1 text-left space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{p.address}</span>
                        <Badge className={PROPERTY_TYPE_COLORS[p.property_type]} variant="secondary">
                          {p.property_type}
                        </Badge>
                        {!p.is_active && (
                          <Badge variant="outline" className="text-muted-foreground">Inactive</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {p.bedrooms != null && (
                          <span className="flex items-center gap-1"><Bed className="h-3 w-3" />{p.bedrooms}</span>
                        )}
                        {p.bathrooms != null && (
                          <span className="flex items-center gap-1"><Bath className="h-3 w-3" />{p.bathrooms}</span>
                        )}
                        {p.square_metres != null && (
                          <span className="flex items-center gap-1"><Ruler className="h-3 w-3" />{p.square_metres}m²</span>
                        )}
                        <ChevronDown className={`h-3 w-3 ml-auto transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                      </div>
                    </CollapsibleTrigger>
                  </div>

                  {canEdit && (
                    <div className="flex items-center gap-2 pt-1 border-t">
                      <div className="flex items-center gap-1.5 text-xs">
                        <Switch
                          checked={p.is_active}
                          onCheckedChange={(v) => toggleActive.mutate({ id: p.id, is_active: v })}
                        />
                        <span className="text-muted-foreground">Active</span>
                      </div>
                      <Button size="sm" variant="ghost" className="ml-auto h-7 px-2" onClick={() => openEdit(p)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(p.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>

                <CollapsibleContent>
                  <div className="px-3 pb-3 pt-0 space-y-2 text-sm border-t">
                    <DetailRow label="Access Code" value={p.access_code} />
                    <DetailRow label="Parking Notes" value={p.parking_notes} />
                    <DetailRow label="Special Instructions" value={p.special_instructions} />
                    <DetailRow label="Preferred Products" value={p.preferred_products} />
                    <DetailRow label="Notes" value={p.notes} />
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </CardContent>
      </Card>

      <PropertyFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        leadId={leadId}
        property={editing}
        defaultAddress={editing ? null : leadAddress}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete property?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The property will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function DetailRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <span className="text-xs text-muted-foreground col-span-1">{label}</span>
      <span className="col-span-2 text-foreground/90 break-words">
        {value || <span className="text-muted-foreground italic">—</span>}
      </span>
    </div>
  );
}
