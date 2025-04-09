import { supabase } from '../utils/supabase'

export default async function handler(req, res) {
  try {
    // Test di lettura
    const { data: messages, error: readError } = await supabase
      .from('messages')
      .select('*')
      .limit(1)

    if (readError) throw readError

    // Test di scrittura
    const testMessage = {
      message_id: 'test-' + Date.now(),
      email: 'test@example.com',
      message_text: 'Test message',
      status: 'pending'
    }

    const { data: insertedMessage, error: writeError } = await supabase
      .from('messages')
      .insert([testMessage])
      .select()

    if (writeError) throw writeError

    res.status(200).json({
      success: true,
      readTest: messages,
      writeTest: insertedMessage
    })
  } catch (error) {
    console.error('Errore nel test Supabase:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
} 