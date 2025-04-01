const { OpenAI } = require('openai');
const axios = require('axios');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export default async function handler(req, res) {
  // Abilita CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Gestisci la richiesta OPTIONS
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Verifica che sia una richiesta POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Ricevuti dati dal form:', req.body);
    
    if (!req.body || !req.body.email) {
      console.error('Dati del form mancanti o invalidi');
      return res.status(400).json({ error: 'Dati del form mancanti o invalidi' });
    }

    // Genera una risposta con OpenAI
    const qualificationText = await generateQualificationText(req.body);
    console.log('Risposta generata:', qualificationText);

    // Invia su Slack
    await sendSlackMessage(req.body, qualificationText);
    console.log('Messaggio inviato su Slack');

    // Invia email su HubSpot
    await sendHubSpotEmail(req.body, qualificationText);
    console.log('Email inviata su HubSpot');

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Errore nel processare la submission:', error);
    res.status(500).json({ error: error.message });
  }
}

// funzione per generare il testo di qualifica
async function generateQualificationText(formData) {
  try {
    console.log('Generazione testo per:', formData.email);
    
    const thread = await openai.beta.threads.retrieve(process.env.ASSISTANT_THREAD_ID);
    console.log('Thread recuperato:', thread.id);

    const message = await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: `Genera una risposta per il seguente lead:\nNome: ${formData.firstname} ${formData.lastname}\nEmail: ${formData.email}\nAzienda: ${formData.company}\nTipo Progetto: ${formData.project_type}\nBudget: ${formData.budget}\nMessaggio: ${formData.message}`
    });
    console.log('Messaggio creato:', message.id);

    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: process.env.ASSISTANT_ID
    });
    console.log('Run creato:', run.id);

    let runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    console.log('Stato iniziale run:', runStatus.status);

    while (runStatus.status !== 'completed') {
      await new Promise(resolve => setTimeout(resolve, 1000));
      runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
      console.log('Stato run aggiornato:', runStatus.status);
    }

    const messages = await openai.beta.threads.messages.list(thread.id);
    console.log('Messaggi recuperati:', messages.data.length);

    const lastMessage = messages.data[0];
    console.log('Ultimo messaggio:', lastMessage.id);

    return lastMessage.content[0].text.value;
  } catch (error) {
    console.error('Errore nella generazione del testo:', error);
    throw error;
  }
}

// funzione per inviare messaggi su Slack
async function sendSlackMessage(formData, qualificationText) {
  try {
    console.log('Invio messaggio su Slack per:', formData.email);
    
    const message = {
      channel: process.env.SLACK_CHANNEL_ID,
      text: `*Nuovo Lead Ricevuto*\n\n*Dettagli:*\nNome: ${formData.firstname} ${formData.lastname}\nEmail: ${formData.email}\nAzienda: ${formData.company}\nTipo Progetto: ${formData.project_type}\nBudget: ${formData.budget}\n\n*Messaggio:*\n${formData.message}\n\n*Risposta Generata:*\n${qualificationText}\n\n<https://leadqualifier.vercel.app/approve?email=${encodeURIComponent(formData.email)}&message=${encodeURIComponent(qualificationText)}|Approva e Invia>`
    };

    const response = await axios.post('https://slack.com/api/chat.postMessage', message, {
      headers: {
        'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.data.ok) {
      throw new Error(`Errore Slack: ${response.data.error}`);
    }

    console.log('Messaggio Slack inviato con successo');
  } catch (error) {
    console.error('Errore nell\'invio del messaggio Slack:', error);
    throw error;
  }
}

// funzione per inviare email su HubSpot
async function sendHubSpotEmail(formData, message) {
  try {
    // Prima troviamo il contatto tramite email
    const contactResponse = await axios.get(
      `https://api.hubapi.com/crm/v3/objects/contacts/search`,
      {
        params: {
          q: formData.email,
          properties: ['hs_object_id']
        },
        headers: {
          'Authorization': `Bearer ${process.env.HUBSPOT_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!contactResponse.data.results || contactResponse.data.results.length === 0) {
      throw new Error('Contatto non trovato');
    }

    const contactId = contactResponse.data.results[0].id;

    // Ora inviamo l'email
    await axios.post(
      'https://api.hubapi.com/crm/v3/objects/emails',
      {
        properties: {
          hs_email_direction: "OUTGOING",
          hs_email_status: "SENT",
          hs_email_subject: "Risposta alla tua richiesta",
          hs_email_text: message,
          hs_timestamp: Date.now(),
          hs_email_to_email: formData.email,
          hs_email_to_firstname: formData.firstname,
          hs_email_to_lastname: formData.lastname
        },
        associations: [
          {
            to: { id: contactId, type: "contact" },
            types: [{ category: "HUBSPOT_DEFINED", typeId: 1 }]
          }
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.HUBSPOT_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (error) {
    console.error('errore invio hubspot:', error);
    throw error;
  }
} 