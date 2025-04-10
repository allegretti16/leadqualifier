import { updateMessage } from '../../utils/supabase';
import { authMiddleware } from '../../middleware/authMiddleware';

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non permesso' });
  }

  const { id } = req.body;

  if (!id) {
    return res.status(400).json({ error: 'ID messaggio mancante' });
  }

  try {
    await updateMessage(id, {
      status: 'rejected',
      rejected_at: new Date().toISOString()
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Errore nel reject del messaggio:', error);
    return res.status(500).json({ error: error.message });
  }
}

export default authMiddleware(handler); 