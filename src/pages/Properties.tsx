import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Property, PropertyType, PROPERTY_TYPE_COLORS } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Loader2, Search } from 'lucide-react';

const TYPES: PropertyType[] = ['Residential', 'Commercial', 'Industrial', 'Other'];

export default function Properties() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

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
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Properties</h1>
        <p className="text-sm text-muted-foreground">All properties across all leads.</p>
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
                {TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Address</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Lead</TableHead>
                  <TableHead className="text-center">Bed</TableHead>
                  <TableHead className="text-center">Bath</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => (
                  <TableRow
                    key={p.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/leads/${p.lead_id}`)}
                  >
                    <TableCell className="font-medium">{p.address}</TableCell>
                    <TableCell>
                      <Badge className={PROPERTY_TYPE_COLORS[p.property_type]} variant="secondary">
                        {p.property_type}
                      </Badge>
                    </TableCell>
                    <TableCell>{p.lead?.full_name ?? '—'}</TableCell>
                    <TableCell className="text-center">{p.bedrooms ?? '—'}</TableCell>
                    <TableCell className="text-center">{p.bathrooms ?? '—'}</TableCell>
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
