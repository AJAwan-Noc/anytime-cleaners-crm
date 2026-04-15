import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// API key middleware
function checkApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

app.use('/api', checkApiKey);

// POST /api/team/create
app.post('/api/team/create', async (req, res) => {
  try {
    const { name, email, phone, role, password } = req.body;

    if (!name || !email || !role) {
      return res.status(400).json({ error: 'name, email, and role are required' });
    }

    const { data: newUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: password || 'Welcome123!',
      email_confirm: true,
    });

    if (authError || !newUser?.user) {
      return res.status(500).json({ error: authError?.message || 'Failed to create auth user' });
    }

    const user_id = newUser.user.id;

    const { data: teamMember, error: insertError } = await supabase
      .from('team_members')
      .insert({
        user_id,
        name,
        email,
        phone: phone || null,
        role,
        is_active: true,
      })
      .select('*')
      .single();

    if (insertError) {
      await supabase.auth.admin.deleteUser(user_id);
      return res.status(500).json({ error: insertError.message });
    }

    return res.json(teamMember);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /api/team/delete
app.delete('/api/team/delete', async (req, res) => {
  try {
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    const { error: dbError } = await supabase
      .from('team_members')
      .delete()
      .eq('user_id', user_id);

    if (dbError) {
      return res.status(500).json({ error: dbError.message });
    }

    const { error: authError } = await supabase.auth.admin.deleteUser(user_id);

    if (authError) {
      return res.status(500).json({ error: authError.message });
    }

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
