import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { ServiceType } from '@/types';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2, Plus, Trash2, GripVertical, Check, Pencil, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, arrayMove, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export default function ServiceTypesSection() {
  const qc = useQueryClient();
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: types = [], isLoading } = useQuery({
    queryKey: ['service-types-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_types')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data as ServiceType[];
    },
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const addType = async () => {
    if (!newName.trim()) return;
    setAdding(true);
    const nextOrder = (types[types.length - 1]?.sort_order ?? 0) + 1;
    const { error } = await supabase
      .from('service_types')
      .insert({ name: newName.trim(), is_active: true, sort_order: nextOrder });
    setAdding(false);
    if (error) return toast.error(error.message);
    setNewName('');
    qc.invalidateQueries({ queryKey: ['service-types-all'] });
    qc.invalidateQueries({ queryKey: ['service-types-active'] });
  };

  const toggleActive = async (id: string, is_active: boolean) => {
    const { error } = await supabase.from('service_types').update({ is_active }).eq('id', id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ['service-types-all'] });
    qc.invalidateQueries({ queryKey: ['service-types-active'] });
  };

  const rename = async (id: string, name: string) => {
    const { error } = await supabase.from('service_types').update({ name }).eq('id', id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ['service-types-all'] });
    qc.invalidateQueries({ queryKey: ['service-types-active'] });
  };

  const remove = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from('service_types').delete().eq('id', deleteId);
    setDeleteId(null);
    if (error) return toast.error(error.message);
    toast.success('Service type deleted');
    qc.invalidateQueries({ queryKey: ['service-types-all'] });
    qc.invalidateQueries({ queryKey: ['service-types-active'] });
  };

  const handleDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = types.findIndex((t) => t.id === active.id);
    const newIdx = types.findIndex((t) => t.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const reordered = arrayMove(types, oldIdx, newIdx);
    // Optimistically update
    qc.setQueryData(['service-types-all'], reordered);
    // Persist new sort_order values
    const updates = reordered.map((t, i) =>
      supabase.from('service_types').update({ sort_order: i + 1 }).eq('id', t.id),
    );
    const results = await Promise.all(updates);
    const failed = results.find((r) => r.error);
    if (failed?.error) toast.error(failed.error.message);
    qc.invalidateQueries({ queryKey: ['service-types-all'] });
    qc.invalidateQueries({ queryKey: ['service-types-active'] });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Service Types</CardTitle>
        <CardDescription>
          Manage the list of service types available when creating leads. Drag to reorder.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input
            placeholder="New service type name…"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addType()}
          />
          <Button onClick={addType} disabled={adding || !newName.trim()} className="gap-1">
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : types.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No service types yet.</p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={types.map((t) => t.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-1.5">
                {types.map((t) => (
                  <SortableRow
                    key={t.id}
                    type={t}
                    onToggleActive={(v) => toggleActive(t.id, v)}
                    onRename={(name) => rename(t.id, name)}
                    onDelete={() => setDeleteId(t.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete service type?</AlertDialogTitle>
              <AlertDialogDescription>
                Existing leads with this service type will keep the value, but it will no longer appear in the list.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={remove}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}

function SortableRow({
  type, onToggleActive, onRename, onDelete,
}: {
  type: ServiceType;
  onToggleActive: (v: boolean) => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: type.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(type.name);

  const save = () => {
    const v = val.trim();
    if (v && v !== type.name) onRename(v);
    setEditing(false);
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 border rounded-md p-2 bg-background">
      <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground touch-none">
        <GripVertical className="h-4 w-4" />
      </button>
      {editing ? (
        <>
          <Input
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save();
              if (e.key === 'Escape') { setVal(type.name); setEditing(false); }
            }}
            autoFocus
            className="h-8"
          />
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={save}>
            <Check className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setVal(type.name); setEditing(false); }}>
            <X className="h-4 w-4" />
          </Button>
        </>
      ) : (
        <>
          <span className="flex-1 text-sm">{type.name}</span>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setVal(type.name); setEditing(true); }}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </>
      )}
      <Switch checked={type.is_active} onCheckedChange={onToggleActive} />
      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onDelete}>
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
