import { OpenAI } from 'openai';
import { supabaseAdmin } from '../../utils/supabase';
import { authMiddleware } from '../../middleware/authMiddleware';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non permesso' });
  }

  const { id } = req.body;

  if (!id) {
    return res.status(400).json({ error: 'ID messaggio mancante' });
  }

  try {
    // Recupera il messaggio usando message_id
    const { data: message, error: fetchError } = await supabaseAdmin
      .from('messages')
      .select('*')
      .eq('message_id', id)
      .limit(1);
    
    if (fetchError) {
      console.error('Errore nel recupero del messaggio:', fetchError);
      return res.status(500).json({ error: fetchError.message });
    }
    
    if (!message || message.length === 0) {
      return res.status(404).json({ error: 'Messaggio non trovato' });
    }

    const messageData = message[0];

    // Estrai i dettagli del form e il messaggio originale
    let formDetails = {};
    if (messageData.form_details) {
      try {
        formDetails = JSON.parse(messageData.form_details);
      } catch (error) {
        console.error('Errore nel parsing dei dettagli del form:', error);
      }
    }

    const originalMessage = messageData.original_message || '';
    
    // Crea il prompt per OpenAI
    const prompt = `
Sei un consulente di Extendi, un'azienda di consulenza IT specializzata in sviluppo software. 
Hai ricevuto il seguente messaggio da un potenziale cliente. 
Rispondi in modo professionale, cordiale e specifico rispetto alle richieste del cliente.

Informazioni sul cliente:
- Nome: ${formDetails.firstname || ''} ${formDetails.lastname || ''}
- Azienda: ${formDetails.company || ''}
- Tipo di progetto: ${formDetails.project_type || ''}
- Budget: ${formDetails.budget || ''}

Messaggio del cliente:
${originalMessage}

La tua risposta deve essere in italiano, professionale ma amichevole, con un tono consulenziale.
Proponi un approccio concreto al loro problema e offri la tua disponibilità per un incontro esplorativo.
Includi dettagli specifici basati sulle informazioni fornite. 
Non inventare informazioni. Se non hai abbastanza dettagli, chiedi gentilmente maggiori informazioni.
Non includere mai loghi, links o immagini nella tua risposta.
Firma la mail come: Dario Calamandrei, Sales Manager at Extendi.
Non includere mai pseudofirme come ---.
`;

    // Chiama l'API OpenAI per generare una nuova risposta
    const completion = await openai.chat.completions.create({
      messages: [
        { role: "system", content: "Sei un consulente di un'azienda di sviluppo software che risponde a potenziali clienti." },
        { role: "user", content: prompt }
      ],
      model: "gpt-4o-mini",
      temperature: 0.9,
      max_tokens: 1000
    });

    // Estrai la risposta generata
    const generatedResponse = completion.choices[0].message.content.trim();

    // Aggiorna il messaggio con la nuova risposta
    const { error: updateError } = await supabaseAdmin
      .from('messages')
      .update({
        message_text: generatedResponse,
        regenerated_at: new Date().toISOString()
      })
      .eq('message_id', id);
    
    if (updateError) {
      console.error('Errore nell\'aggiornamento del messaggio:', updateError);
      return res.status(500).json({ error: updateError.message });
    }

    return res.status(200).json({ 
      success: true, 
      message: 'Risposta rigenerata con successo',
      newText: generatedResponse
    });
  } catch (error) {
    console.error('Errore nella rigenerazione della risposta:', error);
    return res.status(500).json({ error: error.message });
  }
}

export default authMiddleware(handler); 