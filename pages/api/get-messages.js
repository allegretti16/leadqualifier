import { supabaseAdmin } from '../../utils/supabase';
import { authMiddleware } from '../../middleware/authMiddleware';

// Endpoint protetto con il middleware di autenticazione
async function handler(req, res) {
  try {
    // Ottieni i messaggi da Supabase usando la chiave di servizio
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

// Applica il middleware di autenticazione
export default authMiddleware(handler); 