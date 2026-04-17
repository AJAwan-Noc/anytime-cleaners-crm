import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Property, PropertyType, PROPERTY_TYPE_LABELS, CustomField } from '@/types';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { Check, ChevronsUpDown, Loader2, Plus, X } from 'lucide-react';
import { toast } from 'sonner';

const TYPES: PropertyType[] = ['residential', 'commercial', 'industrial', 'other'];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When provided, property is locked to this lead. When omitted, user must pick a lead. */
  leadId?: string;
  property?: Property | null;
  defaultAddress?: string | null;
}

type FormState = {
  lead_id: string;
  address: string;
  property_type: PropertyType;
  bedrooms: string;
  bathrooms: string;
  square_metres: string;
  access_code: string;
  parking_notes: string;
  special_instructions: string;
  preferred_products: string;
  notes: string;
  map_url: string;
  floor_level: string;
  business_name: string;
  hazard_notes: string;
  custom_fields: CustomField[];
};

const empty = (leadId: string, defaultAddress?: string | null): FormState => ({
  lead_id: leadId,
  address: defaultAddress ?? '',
  property_type: 'residential',
  bedrooms: '',
  bathrooms: '',
  square_metres: '',
  access_code: '',
  parking_notes: '',
  special_instructions: '',
  preferred_products: '',
  notes: '',
  map_url: '',
  floor_level: '',
  business_name: '',
  hazard_notes: '',
  custom_fields: [],
});

export default function PropertyFormDialog({
  open, onOpenChange, leadId, property, defaultAddress,
}: Props) {
  const qc = useQueryClient();
  const showLeadPicker = !leadId;
  const [form, setForm] = useState<FormState>(empty(leadId ?? '', defaultAddress));
  const [leadPickerOpen, setLeadPickerOpen] = useState(false);

  const { data: leads = [] } = useQuery({
    queryKey: ['leads-picker'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('id, full_name, address')
        .order('full_name', { ascending: true });
      if (error) throw error;
      return data as Array<{ id: string; full_name: string; address: string | null }>;
    },
    enabled: showLeadPicker && open,
  });

  const selectedLead = useMemo(
    () => leads.find((l) => l.id === form.lead_id) ?? null,
    [leads, form.lead_id],
  );

  useEffect(() => {
    if (property) {
      setForm({
        lead_id: property.lead_id ?? leadId ?? '',
        address: property.address ?? '',
        property_type: property.property_type ?? 'residential',
        bedrooms: property.bedrooms?.toString() ?? '',
        bathrooms: property.bathrooms?.toString() ?? '',
        square_metres: property.square_metres?.toString() ?? '',
        access_code: property.access_code ?? '',
        parking_notes: property.parking_notes ?? '',
        special_instructions: property.special_instructions ?? '',
        preferred_products: property.preferred_products ?? '',
        notes: property.notes ?? '',
        map_url: property.map_url ?? '',
        floor_level: property.floor_level ?? '',
        business_name: property.business_name ?? '',
        hazard_notes: property.hazard_notes ?? '',
        custom_fields: Array.isArray(property.custom_fields) ? property.custom_fields : [],
      });
    } else if (open) {
      setForm(empty(leadId ?? '', defaultAddress));
    }
  }, [property, open, defaultAddress, leadId]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const setCustom = (idx: number, key: 'name' | 'value', val: string) => {
    setForm((p) => ({
      ...p,
      custom_fields: p.custom_fields.map((f, i) => (i === idx ? { ...f, [key]: val } : f)),
    }));
  };
  const addCustom = () => setForm((p) => ({ ...p, custom_fields: [...p.custom_fields, { name: '', value: '' }] }));
  const removeCustom = (idx: number) =>
    setForm((p) => ({ ...p, custom_fields: p.custom_fields.filter((_, i) => i !== idx) }));

  const saveMutation = useMutation({
    mutationFn: async () => {
      const t = form.property_type;
      // Build payload with type-specific fields nullified when not relevant.
      const payload = {
        lead_id: form.lead_id,
        address: form.address.trim(),
        property_type: t,
        bedrooms: t === 'residential' && form.bedrooms ? Number(form.bedrooms) : null,
        bathrooms: t === 'residential' && form.bathrooms ? Number(form.bathrooms) : null,
        square_metres: form.square_metres ? Number(form.square_metres) : null,
        access_code: form.access_code.trim() || null,
        parking_notes: form.parking_notes.trim() || null,
        special_instructions: form.special_instructions.trim() || null,
        preferred_products: t === 'residential' && form.preferred_products.trim() ? form.preferred_products.trim() : null,
        notes: form.notes.trim() || null,
        map_url: form.map_url.trim() || null,
        floor_level: t === 'commercial' && form.floor_level.trim() ? form.floor_level.trim() : null,
        business_name: t === 'commercial' && form.business_name.trim() ? form.business_name.trim() : null,
        hazard_notes: t === 'industrial' && form.hazard_notes.trim() ? form.hazard_notes.trim() : null,
        custom_fields: form.custom_fields.filter((f) => f.name.trim() && f.value.trim()),
      };
      if (property) {
        const { error } = await supabase.from('properties').update(payload).eq('id', property.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('properties').insert({ ...payload, is_active: true });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(property ? 'Property updated' : 'Property added');
      if (form.lead_id) qc.invalidateQueries({ queryKey: ['lead-properties', form.lead_id] });
      qc.invalidateQueries({ queryKey: ['properties-all'] });
      qc.invalidateQueries({ queryKey: ['property', property?.id] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(`Failed to save: ${e.message}`),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.lead_id) { toast.error('Please select a lead'); return; }
    if (!form.address.trim()) { toast.error('Address is required'); return; }
    saveMutation.mutate();
  };

  const t = form.property_type;
  const showResidential = t === 'residential' || t === 'other';
  const showCommercialOnly = t === 'commercial';
  const showIndustrialOnly = t === 'industrial';
  const showShared = t !== 'other'; // shared block (access/parking/instructions) - always for non-other; for "other" we show all basic fields anyway
  const showAccessParkingInstr = true; // residential/commercial/industrial/other all use these
  const showSquare = true;
  const showPreferred = t === 'residential' || t === 'other';
  const showBedBath = t === 'residential' || t === 'other';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{property ? 'Edit Property' : 'Add Property'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {showLeadPicker && (
            <div className="space-y-1.5">
              <Label>Lead *</Label>
              <Popover open={leadPickerOpen} onOpenChange={setLeadPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    className={cn('w-full justify-between font-normal', !selectedLead && 'text-muted-foreground')}
                  >
                    {selectedLead ? selectedLead.full_name : 'Select a lead…'}
                    <ChevronsUpDown className="h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search leads…" />
                    <CommandList>
                      <CommandEmpty>No leads found.</CommandEmpty>
                      <CommandGroup>
                        {leads.map((l) => (
                          <CommandItem
                            key={l.id}
                            value={`${l.full_name} ${l.address ?? ''}`}
                            onSelect={() => {
                              set('lead_id', l.id);
                              if (!form.address.trim() && l.address) set('address', l.address);
                              setLeadPickerOpen(false);
                            }}
                          >
                            <Check className={cn('mr-2 h-4 w-4', form.lead_id === l.id ? 'opacity-100' : 'opacity-0')} />
                            <div className="flex flex-col">
                              <span>{l.full_name}</span>
                              {l.address && <span className="text-xs text-muted-foreground">{l.address}</span>}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Address *</Label>
            <Input value={form.address} onChange={(e) => set('address', e.target.value)} required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Property Type</Label>
              <Select value={form.property_type} onValueChange={(v) => set('property_type', v as PropertyType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPES.map((tt) => <SelectItem key={tt} value={tt}>{PROPERTY_TYPE_LABELS[tt]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {showSquare && (
              <div className="space-y-1.5">
                <Label>Square Metres</Label>
                <Input type="number" min="0" value={form.square_metres} onChange={(e) => set('square_metres', e.target.value)} />
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Map Link <span className="text-muted-foreground font-normal">(Google / Apple Maps URL)</span></Label>
            <Input
              type="url" inputMode="url"
              value={form.map_url}
              onChange={(e) => set('map_url', e.target.value)}
              placeholder="https://maps.google.com/?q=..."
            />
          </div>

          {/* Commercial-only fields */}
          {showCommercialOnly && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Business Name</Label>
                <Input value={form.business_name} onChange={(e) => set('business_name', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Floor Level</Label>
                <Input value={form.floor_level} onChange={(e) => set('floor_level', e.target.value)} placeholder="e.g. Level 3" />
              </div>
            </div>
          )}

          {/* Industrial-only fields */}
          {showIndustrialOnly && (
            <div className="space-y-1.5">
              <Label>Hazard Notes</Label>
              <Textarea rows={2} value={form.hazard_notes} onChange={(e) => set('hazard_notes', e.target.value)} placeholder="Any safety hazards on site…" />
            </div>
          )}

          {/* Residential bed/bath */}
          {showBedBath && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Bedrooms</Label>
                <Input type="number" min="0" value={form.bedrooms} onChange={(e) => set('bedrooms', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Bathrooms</Label>
                <Input type="number" min="0" value={form.bathrooms} onChange={(e) => set('bathrooms', e.target.value)} />
              </div>
            </div>
          )}

          {showAccessParkingInstr && (
            <>
              <div className="space-y-1.5">
                <Label>Access Code</Label>
                <Input value={form.access_code} onChange={(e) => set('access_code', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Parking Notes</Label>
                <Textarea rows={2} value={form.parking_notes} onChange={(e) => set('parking_notes', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Special Instructions</Label>
                <Textarea rows={2} value={form.special_instructions} onChange={(e) => set('special_instructions', e.target.value)} />
              </div>
            </>
          )}

          {showPreferred && (
            <div className="space-y-1.5">
              <Label>Preferred Products</Label>
              <Input value={form.preferred_products} onChange={(e) => set('preferred_products', e.target.value)} placeholder="e.g. Eco-friendly only" />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          </div>

          {/* Custom Fields */}
          <div className="space-y-2 border-t pt-3">
            <div className="flex items-center justify-between">
              <Label>Custom Fields</Label>
              <Button type="button" size="sm" variant="outline" onClick={addCustom} className="gap-1">
                <Plus className="h-3.5 w-3.5" /> Add Field
              </Button>
            </div>
            {form.custom_fields.length === 0 ? (
              <p className="text-xs text-muted-foreground">Add any extra info about the property (e.g. "Wifi password", "Pet name").</p>
            ) : (
              <div className="space-y-2">
                {form.custom_fields.map((f, i) => (
                  <div key={i} className="flex gap-2">
                    <Input placeholder="Field name" value={f.name} onChange={(e) => setCustom(i, 'name', e.target.value)} className="flex-1" />
                    <Input placeholder="Value" value={f.value} onChange={(e) => setCustom(i, 'value', e.target.value)} className="flex-1" />
                    <Button type="button" size="icon" variant="ghost" onClick={() => removeCustom(i)} className="text-destructive hover:text-destructive shrink-0">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {property ? 'Save Changes' : 'Add Property'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
