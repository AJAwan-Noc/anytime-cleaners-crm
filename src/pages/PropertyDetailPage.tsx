import { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Property, PROPERTY_TYPE_COLORS, PROPERTY_TYPE_LABELS } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  ArrowLeft, Bath, Bed, ExternalLink, Loader2, Map, MapPin, Pencil, Ruler, Trash2, User,
} from 'lucide-react';
import { toast } from 'sonner';
import PropertyFormDialog from '@/components/properties/PropertyFormDialog';

export default function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { role } = useAuth();
  const canEdit = role === 'owner' || role === 'admin' || role === 'manager';

  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: property, isLoading, isError } = useQuery({
    queryKey: ['property', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('properties')
        .select('*, lead:leads(id, full_name)')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as Property;
    },
    enabled: !!id,
  });

  const toggleActive = useMutation({
    mutationFn: async (is_active: boolean) => {
      const { error } = await supabase.from('properties').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['property', id] });
      qc.invalidateQueries({ queryKey: ['properties-all'] });
      if (property?.lead_id) {
        qc.invalidateQueries({ queryKey: ['lead-properties', property.lead_id] });
      }
    },
    onError: () => toast.error('Failed to update'),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('properties').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Property deleted');
      qc.invalidateQueries({ queryKey: ['properties-all'] });
      if (property?.lead_id) {
        qc.invalidateQueries({ queryKey: ['lead-properties', property.lead_id] });
      }
      navigate('/properties');
    },
    onError: () => toast.error('Failed to delete'),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !property) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/properties')} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Back to Properties
        </Button>
        <p className="text-muted-foreground">Property not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate('/properties')} className="gap-1.5 -ml-2">
          <ArrowLeft className="h-4 w-4" /> Back to Properties
        </Button>
      </div>

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold">{property.address}</h1>
            <Badge className={PROPERTY_TYPE_COLORS[property.property_type]} variant="secondary">
              {PROPERTY_TYPE_LABELS[property.property_type]}
            </Badge>
            {property.is_active ? (
              <Badge className="bg-green-100 text-green-800" variant="secondary">Active</Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground">Inactive</Badge>
            )}
          </div>
          {property.lead && (
            <Link
              to={`/leads/${property.lead.id}`}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground hover:underline"
            >
              <User className="h-3.5 w-3.5" />
              {property.lead.full_name}
            </Link>
          )}
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 h-10 rounded-md border bg-background">
              <Switch
                checked={property.is_active}
                onCheckedChange={(v) => toggleActive.mutate(v)}
              />
              <span className="text-sm text-muted-foreground">Active</span>
            </div>
            <Button variant="outline" onClick={() => setEditOpen(true)} className="gap-1.5">
              <Pencil className="h-4 w-4" /> Edit
            </Button>
            <Button
              variant="outline"
              onClick={() => setConfirmDelete(true)}
              className="gap-1.5 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Property Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <DetailRow icon={<MapPin className="h-4 w-4" />} label="Address" value={property.address} />
            <div className="grid grid-cols-3 gap-4">
              <Stat icon={<Bed className="h-4 w-4" />} label="Bedrooms" value={property.bedrooms} />
              <Stat icon={<Bath className="h-4 w-4" />} label="Bathrooms" value={property.bathrooms} />
              <Stat
                icon={<Ruler className="h-4 w-4" />}
                label="Square Metres"
                value={property.square_metres != null ? `${property.square_metres} m²` : null}
              />
            </div>
            <DetailRow label="Access Code" value={property.access_code} />
            <DetailRow label="Parking Notes" value={property.parking_notes} multiline />
            <DetailRow label="Special Instructions" value={property.special_instructions} multiline />
            <DetailRow label="Preferred Products" value={property.preferred_products} />
            <DetailRow label="Notes" value={property.notes} multiline />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Meta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <MetaRow label="Created" value={new Date(property.created_at).toLocaleString()} />
            <MetaRow label="Updated" value={new Date(property.updated_at).toLocaleString()} />
            <MetaRow label="ID" value={<code className="text-xs">{property.id}</code>} />
          </CardContent>
        </Card>
      </div>

      <PropertyFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        leadId={property.lead_id}
        property={property}
      />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
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
              onClick={() => deleteMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function DetailRow({
  icon, label, value, multiline,
}: { icon?: React.ReactNode; label: string; value: string | null; multiline?: boolean }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground col-span-1">
        {icon}
        {label}
      </div>
      <div className={`col-span-2 text-sm text-foreground/90 ${multiline ? 'whitespace-pre-wrap' : ''} break-words`}>
        {value || <span className="text-muted-foreground italic">—</span>}
      </div>
    </div>
  );
}

function Stat({
  icon, label, value,
}: { icon: React.ReactNode; label: string; value: number | string | null }) {
  return (
    <div className="rounded-md border bg-muted/30 p-3 space-y-1">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon} {label}
      </div>
      <div className="text-lg font-semibold">
        {value ?? <span className="text-muted-foreground font-normal">—</span>}
      </div>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right break-all">{value}</span>
    </div>
  );
}
