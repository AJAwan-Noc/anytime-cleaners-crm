import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Property, PropertyType, PROPERTY_TYPE_COLORS, PROPERTY_TYPE_LABELS } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Loader2, Plus, Search } from 'lucide-react';
import PropertyFormDialog from '@/components/properties/PropertyFormDialog';

const TYPES: PropertyType[] = ['residential', 'commercial', 'industrial', 'other'];

export default function Properties() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const canCreate = role === 'owner' || role === 'admin' || role === 'manager';
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [createOpen, setCreateOpen] = useState(false);

  const { data: properties = [], isLoading } = useQuery({
    queryKey: ['properties-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('properties')
        .select('*, lead:leads(id, full_name)')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data as Property[];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return properties.filter((p) => {
      if (typeFilter !== 'all' && p.property_type !== typeFilter) return false;
      if (q && !p.address?.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [properties, search, typeFilter]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Properties</h1>
          <p className="text-sm text-muted-foreground">All properties across all leads.</p>
        </div>
        {canCreate && (
          <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
            <Plus className="h-4 w-4" /> Add Property
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Properties</CardTitle>
          <div className="flex flex-col sm:flex-row gap-3 pt-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by address…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {TYPES.map((t) => <SelectItem key={t} value={t}>{PROPERTY_TYPE_LABELS[t]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No properties found.</p>
          ) : (
            <div className="overflow-x-auto -mx-6 px-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Address</TableHead>
                    <TableHead className="hidden sm:table-cell">Type</TableHead>
                    <TableHead className="hidden md:table-cell">Lead</TableHead>
                    <TableHead className="hidden lg:table-cell text-center">Bed</TableHead>
                    <TableHead className="hidden lg:table-cell text-center">Bath</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p) => (
                    <TableRow
                      key={p.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/properties/${p.id}`)}
                    >
                      <TableCell className="font-medium max-w-[240px] truncate">{p.address}</TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge className={PROPERTY_TYPE_COLORS[p.property_type]} variant="secondary">
                          {PROPERTY_TYPE_LABELS[p.property_type]}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">{p.lead?.full_name ?? '—'}</TableCell>
                      <TableCell className="hidden lg:table-cell text-center">{p.bedrooms ?? '—'}</TableCell>
                      <TableCell className="hidden lg:table-cell text-center">{p.bathrooms ?? '—'}</TableCell>
                      <TableCell>
                        {p.is_active ? (
                          <Badge className="bg-green-100 text-green-800" variant="secondary">Active</Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">Inactive</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <PropertyFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        property={null}
      />
    </div>
  );
}
