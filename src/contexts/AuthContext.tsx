import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { TeamMember, Role } from '@/types';
import { toast } from 'sonner';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  teamMember: TeamMember | null;
  role: Role | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [teamMember, setTeamMember] = useState<TeamMember | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  const denyAccess = async () => {
    toast.error('Access denied. Your account is not set up in the CRM. Contact your administrator.');
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setTeamMember(null);
    setRole(null);
  };

  const fetchTeamMember = async (userId: string): Promise<boolean> => {
    const { data, error } = await supabase
      .from('team_members')
      .select('id, user_id, name, email, phone, role, cleaner_type, is_active, lead_id, created_at')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      console.error('Failed to fetch team member:', error);
      setTeamMember(null);
      setRole(null);
      await denyAccess();
      return false;
    }

    setTeamMember(data as TeamMember);
    setRole(data.role as Role);
    return true;
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          setTimeout(() => fetchTeamMember(session.user.id), 0);
        } else {
          setTeamMember(null);
          setRole(null);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchTeamMember(session.user.id).then(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setTeamMember(null);
    setRole(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, teamMember, role, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
