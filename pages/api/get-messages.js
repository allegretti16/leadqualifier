import { supabaseAdmin } from '../../utils/supabase';

export default async function handler(req, res) {
  // Verifica se l'utente è autenticato (controlla il cookie auth)
  if (!req.cookies.auth && !req.cookies.isAuthenticated) {
    return res.status(401).json({ error: 'Non autorizzato' });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('messages')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Errore nel recupero dei messaggi:', error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error('Errore nel recupero dei messaggi:', err);
    return res.status(500).json({ error: 'Errore del server' });
  }
} 