import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Mail, Edit } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface EmailTemplate {
  template_key: string;
  name: string;
  subject: string;
  updated_at: string;
}

export default function EmailTemplates() {
  const navigate = useNavigate();

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['email_templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_templates')
        .select('template_key, name, subject, updated_at')
        .order('name');
      if (error) throw error;
      return data as EmailTemplate[];
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold">Email Templates</h1>

      {templates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Mail className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p>No email templates found. Add rows to the <code>email_templates</code> table to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {templates.map((t) => (
            <Card key={t.template_key} className="flex flex-col justify-between">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{t.name}</CardTitle>
                <p className="text-sm text-muted-foreground truncate">{t.subject}</p>
              </CardHeader>
              <CardContent className="flex items-center justify-between pt-0">
                <span className="text-xs text-muted-foreground">
                  Updated {new Date(t.updated_at).toLocaleDateString()}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  onClick={() => navigate(`/admin/email-templates/${t.template_key}`)}
                >
                  <Edit className="h-3.5 w-3.5" /> Edit
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
