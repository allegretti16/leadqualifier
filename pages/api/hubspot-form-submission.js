import { saveMessage } from '../../utils/supabase';

export default async function handler(req, res) {
  // Gestione CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Gestione della richiesta OPTIONS (preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, message, formDetails, originalMessage } = req.body;

    if (!email || !message) {
      return res.status(400).json({ error: 'Email and message are required' });
    }

    // Genera un ID unico per il messaggio
    const messageId = Math.random().toString(36).substring(2, 15);

    // Salva il messaggio in Supabase
    const savedMessage = await saveMessage({
      id: messageId,
      email,
      message,
      formDetails,
      originalMessage
    });

    return res.status(200).json({
      success: true,
      messageId: savedMessage.message_id
    });
  } catch (error) {
    console.error('Errore nella submission del form:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 