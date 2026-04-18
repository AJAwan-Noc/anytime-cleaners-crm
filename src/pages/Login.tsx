import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import logo from '@/assets/logo.png';

export default function Login() {
  const { user, role, loading: authLoading, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-navy-gradient">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please enter your email and password.');
      return;
    }
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) toast.error(error);
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 bg-navy-gradient overflow-hidden">
      {/* Animated blobs */}
      <div className="pointer-events-none absolute top-0 -left-20 h-[400px] w-[400px] rounded-full bg-accent/30 blur-3xl animate-blob" />
      <div className="pointer-events-none absolute bottom-0 -right-20 h-[400px] w-[400px] rounded-full bg-primary/25 blur-3xl animate-blob" style={{ animationDelay: '2s' }} />
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-accent/10 blur-3xl animate-blob" style={{ animationDelay: '4s' }} />

      <div className="relative w-full max-w-md animate-fade-in-up">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative mb-4">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-accent to-primary blur-2xl opacity-60 animate-pulse-glow" />
            <img
              src={logo}
              alt="Anytime Cleaners"
              className="relative h-24 w-24 object-contain rounded-2xl animate-float"
            />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Anytime <span className="text-brand-gradient">Cleaners</span>
          </h1>
          <p className="text-sm text-white/60 mt-1 flex items-center gap-1.5">
            <Sparkles className="h-3 w-3 text-primary" />
            we clean it, we mean it
          </p>
        </div>

        {/* Card */}
        <div className="relative rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl p-8">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
          <form onSubmit={handleSubmit} className="relative space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-white/80 text-xs uppercase tracking-wider">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus-visible:ring-primary h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-white/80 text-xs uppercase tracking-wider">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus-visible:ring-primary h-11"
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-gradient-to-r from-accent to-primary hover:from-accent/90 hover:to-primary/90 text-primary-foreground font-semibold shadow-brand transition-all hover:shadow-accent-glow hover:scale-[1.01]"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Sign In
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-white/40 mt-6">
          © {new Date().getFullYear()} Anytime Cleaners CRM
        </p>
      </div>
    </div>
  );
}
