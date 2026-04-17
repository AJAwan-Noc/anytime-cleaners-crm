import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Property, PropertyType, PROPERTY_TYPE_LABELS } from '@/types';
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
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
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
});

export default function PropertyFormDialog({
  open, onOpenChange, leadId, property, defaultAddress,
}: Props) {
  const qc = useQueryClient();
  const showLeadPicker = !leadId;
  const [form, setForm] = useState<FormState>(empty(leadId ?? '', defaultAddress));
  const [leadPickerOpen, setLeadPickerOpen] = useState(false);

  // Only fetch leads when picker is needed
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
      });
    } else if (open) {
      setForm(empty(leadId ?? '', defaultAddress));
    }
  }, [property, open, defaultAddress, leadId]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        lead_id: form.lead_id,
        address: form.address.trim(),
        property_type: form.property_type,
        bedrooms: form.bedrooms ? Number(form.bedrooms) : null,
        bathrooms: form.bathrooms ? Number(form.bathrooms) : null,
        square_metres: form.square_metres ? Number(form.square_metres) : null,
        access_code: form.access_code.trim() || null,
        parking_notes: form.parking_notes.trim() || null,
        special_instructions: form.special_instructions.trim() || null,
        preferred_products: form.preferred_products.trim() || null,
        notes: form.notes.trim() || null,
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
      if (form.lead_id) {
        qc.invalidateQueries({ queryKey: ['lead-properties', form.lead_id] });
      }
      qc.invalidateQueries({ queryKey: ['properties-all'] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(`Failed to save: ${e.message}`),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.lead_id) {
      toast.error('Please select a lead');
      return;
    }
    if (!form.address.trim()) {
      toast.error('Address is required');
      return;
    }
    saveMutation.mutate();
  };

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
                    className={cn(
                      'w-full justify-between font-normal',
                      !selectedLead && 'text-muted-foreground',
                    )}
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
                              if (!form.address.trim() && l.address) {
                                set('address', l.address);
                              }
                              setLeadPickerOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                'mr-2 h-4 w-4',
                                form.lead_id === l.id ? 'opacity-100' : 'opacity-0',
                              )}
                            />
                            <div className="flex flex-col">
                              <span>{l.full_name}</span>
                              {l.address && (
                                <span className="text-xs text-muted-foreground">{l.address}</span>
                              )}
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
                  {TYPES.map((t) => <SelectItem key={t} value={t}>{PROPERTY_TYPE_LABELS[t]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Square Metres</Label>
              <Input type="number" min="0" value={form.square_metres} onChange={(e) => set('square_metres', e.target.value)} />
            </div>
          </div>

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

          <div className="space-y-1.5">
            <Label>Preferred Products</Label>
            <Input value={form.preferred_products} onChange={(e) => set('preferred_products', e.target.value)} placeholder="e.g. Eco-friendly only" />
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
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
