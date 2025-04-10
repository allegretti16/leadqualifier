import { OpenAI } from 'openai';
import { updateMessage, getMessage } from '../../utils/supabase';
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
    // Recupera il messaggio originale
    const message = await getMessage(id);
    if (!message) {
      return res.status(404).json({ error: 'Messaggio non trovato' });
    }

    // Estrai i dettagli del form e il messaggio originale
    let formDetails = {};
    if (message.form_details) {
      try {
        formDetails = JSON.parse(message.form_details);
      } catch (error) {
        console.error('Errore nel parsing dei dettagli del form:', error);
      }
    }

    const originalMessage = message.original_message || '';
    
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
    await updateMessage(id, {
      message_text: generatedResponse,
      regenerated_at: new Date().toISOString()
    });

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