import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Le variabili d\'ambiente Supabase non sono configurate correttamente')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Funzioni per la gestione dei messaggi
export const saveMessage = async (messageData) => {
  const { data, error } = await supabase
    .from('messages')
    .insert([
      {
        message_id: messageData.id,
        email: messageData.email,
        message_text: messageData.message,
        form_details: messageData.formDetails,
        original_message: messageData.originalMessage,
        status: 'pending',
        created_at: new Date().toISOString()
      }
    ])
    .select()

  if (error) throw error
  return data[0]
}

export const getMessage = async (messageId) => {
  console.log('Tentativo di recupero messaggio con ID:', messageId);
  
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('message_id', messageId)
    .single()

  if (error) {
    console.error('Errore nel recupero del messaggio:', error);
    throw error;
  }
  
  console.log('Messaggio recuperato:', data ? 'Sì' : 'No');
  return data
}

export const updateMessage = async (messageId, updates) => {
  const { data, error } = await supabase
    .from('messages')
    .update(updates)
    .eq('id', messageId)
    .select()

  if (error) throw error
  return data[0]
}

export async function getMessages() {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Errore nel recupero dei messaggi:', error);
    throw error;
  }

  return data;
} 