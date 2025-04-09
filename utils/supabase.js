import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Mancano le variabili d\'ambiente per Supabase')
}

export const supabase = createClient(supabaseUrl, supabaseKey)

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
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('message_id', messageId)
    .single()

  if (error) throw error
  return data
}

export const updateMessage = async (messageId, updates) => {
  const { data, error } = await supabase
    .from('messages')
    .update(updates)
    .eq('message_id', messageId)
    .select()

  if (error) throw error
  return data[0]
} 