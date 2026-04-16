import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase, N8N_BASE_URL } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, Send, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

declare global {
  interface Window { Quill: any; }
}

const SAMPLE_DATA: Record<string, string> = {
  '{name}': 'John Smith',
  '{service}': 'Deep Clean',
  '{phone}': '+61412345678',
  '{address}': '42 George St Sydney',
  '{invoice_number}': 'AC-0001',
  '{new_stage}': 'Booked',
  '{old_stage}': 'Contacted',
  '{changed_by}': 'AJ',
  '{report}': 'Sample AI report text',
};

function replaceVariables(html: string) {
  let result = html;
  for (const [k, v] of Object.entries(SAMPLE_DATA)) {
    result = result.split(k).join(`<span style="background:#fef3c7;padding:1px 4px;border-radius:3px">${v}</span>`);
  }
  return result;
}

interface TemplateRow {
  template_key: string;
  name: string;
  subject: string;
  header_color: string;
  logo_url: string;
  body_html: string;
  footer_text: string;
  variables: string[];
}

export default function EmailTemplateEditor() {
  const { template_key } = useParams<{ template_key: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: template, isLoading } = useQuery({
    queryKey: ['email_template', template_key],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .eq('template_key', template_key)
        .single();
      if (error) throw error;
      return data as TemplateRow;
    },
  });

  const [subject, setSubject] = useState('');
  const [headerColor, setHeaderColor] = useState('#4F46E5');
  const [logoUrl, setLogoUrl] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [footerText, setFooterText] = useState('');
  const [variables, setVariables] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  const editorRef = useRef<HTMLDivElement>(null);
  const quillRef = useRef<any>(null);

  useEffect(() => {
    if (template) {
      setSubject(template.subject || '');
      setHeaderColor(template.header_color || '#4F46E5');
      setLogoUrl(template.logo_url || '');
      setBodyHtml(template.body_html || '');
      setFooterText(template.footer_text || '');
      setVariables(template.variables || []);
    }
  }, [template]);

  // Init Quill
  useEffect(() => {
    if (!editorRef.current || quillRef.current || !template) return;

    const initQuill = () => {
      if (!window.Quill || !editorRef.current) return;
      const q = new window.Quill(editorRef.current, {
        theme: 'snow',
        modules: {
          toolbar: [
            ['bold', 'italic', 'underline'],
            [{ size: ['small', false, 'large', 'huge'] }],
            [{ color: [] }, { background: [] }],
            [{ list: 'ordered' }, { list: 'bullet' }],
            ['link', 'image'],
            ['clean'],
          ],
        },
      });
      q.root.innerHTML = template.body_html || '';
      q.on('text-change', () => {
        setBodyHtml(q.root.innerHTML);
      });
      quillRef.current = q;
    };

    if (window.Quill) {
      initQuill();
    } else {
      const interval = setInterval(() => {
        if (window.Quill) {
          clearInterval(interval);
          initQuill();
        }
      }, 200);
      return () => clearInterval(interval);
    }
  }, [template]);

  const insertVariable = useCallback((variable: string) => {
    const q = quillRef.current;
    if (!q) return;
    const range = q.getSelection(true);
    q.insertText(range.index, `{${variable}}`);
    q.setSelection(range.index + variable.length + 2);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('email_templates')
        .update({
          subject,
          header_color: headerColor,
          logo_url: logoUrl,
          body_html: bodyHtml,
          footer_text: footerText,
          updated_at: new Date().toISOString(),
        })
        .eq('template_key', template_key);
      if (error) throw error;
      toast.success('Template saved');
    } catch (e: any) {
      toast.error(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmail = async () => {
    if (!user?.email) {
      toast.error('No email found for current user');
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`${N8N_BASE_URL}/test-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template_key, to_email: user.email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        throw new Error(data.error || 'Failed to send test email');
      }
      toast.success(`Test email sent to ${user.email}`);
    } catch (e: any) {
      toast.error(e.message || 'Failed to send test email');
    } finally {
      setSending(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Template not found.
        <Button variant="link" onClick={() => navigate('/admin/email-templates')}>Go back</Button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/admin/email-templates')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-xl font-bold">{template.name}</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left panel - Editor */}
        <div className="lg:col-span-3 space-y-4">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-1">
                <Label>Subject Line</Label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Header Color</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={headerColor}
                      onChange={(e) => setHeaderColor(e.target.value)}
                      className="h-10 w-14 rounded border border-input cursor-pointer"
                    />
                    <Input value={headerColor} onChange={(e) => setHeaderColor(e.target.value)} className="flex-1" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Logo URL</Label>
                  <Input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://..." />
                  {logoUrl && (
                    <img
                      src={logoUrl}
                      alt="Logo preview"
                      className="h-8 mt-1 object-contain"
                      onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
                    />
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <Label>Body</Label>
                <div ref={editorRef} className="min-h-[250px]" />
              </div>

              <div className="space-y-1">
                <Label>Footer Text</Label>
                <Input value={footerText} onChange={(e) => setFooterText(e.target.value)} />
              </div>
            </CardContent>
          </Card>

          {/* Variable chips */}
          {variables.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Available Variables</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {variables.map((v) => (
                  <Badge
                    key={v}
                    variant="secondary"
                    className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                    onClick={() => insertVariable(v)}
                  >
                    {`{${v}}`}
                  </Badge>
                ))}
              </CardContent>
            </Card>
          )}

          <div className="flex gap-3">
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Template
            </Button>
            <Button variant="outline" onClick={handleTestEmail} disabled={sending} className="gap-2">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send Test Email
            </Button>
          </div>
        </div>

        {/* Right panel - Preview */}
        <div className="lg:col-span-2">
          <Card className="sticky top-6">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Live Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden bg-white text-gray-800">
                {/* Header */}
                <div
                  style={{ backgroundColor: headerColor }}
                  className="px-6 py-4 flex items-center gap-3"
                >
                  {logoUrl && (
                    <img
                      src={logoUrl}
                      alt="Logo"
                      className="h-8 object-contain"
                      onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
                    />
                  )}
                  <span className="text-white font-semibold text-sm">
                    {subject ? replaceVariables(subject).replace(/<[^>]*>/g, '') : 'Email Subject'}
                  </span>
                </div>

                {/* Body */}
                <div
                  className="px-6 py-5 text-sm leading-relaxed prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: replaceVariables(bodyHtml) || '<p class="text-gray-400">Email body will appear here...</p>' }}
                />

                {/* Footer */}
                {footerText && (
                  <div className="px-6 py-3 border-t bg-gray-50 text-xs text-gray-500 text-center">
                    {footerText}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
