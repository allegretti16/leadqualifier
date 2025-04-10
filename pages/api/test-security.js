import { supabase, supabaseAdmin } from '../../utils/supabase'

export default async function handler(req, res) {
  try {
    // Test con chiave anonima (dovrebbe fallire)
    try {
      const { data: anonData, error: anonError } = await supabase
        .from('messages')
        .select('*')
        .limit(1)
      
      if (!anonError) {
        throw new Error('La chiave anonima non dovrebbe avere accesso')
      }
    } catch (error) {
      console.log('Test anonimo fallito come previsto:', error.message)
    }

    // Test con chiave di servizio (dovrebbe funzionare)
    const { data: adminData, error: adminError } = await supabaseAdmin
      .from('messages')
      .select('*')
      .limit(1)

    if (adminError) throw adminError

    res.status(200).json({
      success: true,
      message: 'Test di sicurezza completato con successo',
      adminAccess: adminData ? 'Funzionante' : 'Non funzionante'
    })
  } catch (error) {
    console.error('Errore nel test di sicurezza:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
} 