import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { ServiceType } from '@/types';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

/**
 * Service-type picker backed by the `service_types` table.
 * - Shows active types sorted by sort_order.
 * - Allows typing a custom value; on selection of a custom value it inserts a new row.
 */
export default function ServiceTypeCombobox({ value, onChange, disabled, placeholder = 'Select service type…' }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const { data: types = [] } = useQuery({
    queryKey: ['service-types-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_types')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data as ServiceType[];
    },
  });

  const trimmed = query.trim();
  const lower = trimmed.toLowerCase();
  const exists = types.some((t) => t.name.toLowerCase() === lower);
  const showCreate = !!trimmed && !exists;

  const pickExisting = (name: string) => {
    onChange(name);
    setOpen(false);
    setQuery('');
  };

  const createAndPick = async () => {
    if (!trimmed) return;
    const nextOrder = (types[types.length - 1]?.sort_order ?? 0) + 1;
    const { error } = await supabase
      .from('service_types')
      .insert({ name: trimmed, is_active: true, sort_order: nextOrder });
    if (!error) {
      qc.invalidateQueries({ queryKey: ['service-types-active'] });
      qc.invalidateQueries({ queryKey: ['service-types-all'] });
    }
    onChange(trimmed);
    setOpen(false);
    setQuery('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          disabled={disabled}
          className={cn('w-full justify-between font-normal', !value && 'text-muted-foreground')}
        >
          {value || placeholder}
          <ChevronsUpDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter>
          <CommandInput
            placeholder="Search or type new…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>
              {showCreate ? (
                <button
                  type="button"
                  onClick={createAndPick}
                  className="flex w-full items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent rounded"
                >
                  <Plus className="h-4 w-4" /> Create "{trimmed}"
                </button>
              ) : (
                'No service types'
              )}
            </CommandEmpty>
            <CommandGroup>
              {types.map((t) => (
                <CommandItem key={t.id} value={t.name} onSelect={() => pickExisting(t.name)}>
                  <Check className={cn('mr-2 h-4 w-4', value === t.name ? 'opacity-100' : 'opacity-0')} />
                  {t.name}
                </CommandItem>
              ))}
              {showCreate && (
                <CommandItem value={`__create_${trimmed}`} onSelect={createAndPick}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create "{trimmed}"
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
