const { OpenAI } = require('openai');

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
    console.log('Headers della richiesta:', JSON.stringify(req.headers, null, 2));
    
    // Gestione speciale per richieste no-cors
    let formData;
    if (req.headers['content-type'] === 'text/plain' || !req.body || Object.keys(req.body).length === 0) {
      try {
        // Tenta di leggere il body della request come stringa
        const rawBody = JSON.stringify(req.body);
        console.log('Raw body ricevuto:', rawBody);
        
        try {
          formData = JSON.parse(rawBody);
        } catch (e) {
          console.log('Errore nel parsing del JSON:', e);
          // Se il JSON parsing fallisce, cerca di estrarre i dati manualmente
          formData = {};
        }
      } catch (error) {
        console.error('Errore nella lettura del body:', error);
        formData = {};
      }
    } else {
      formData = req.body;
    }
    
    console.log('Dati del form processati:', JSON.stringify(formData, null, 2));
    
    // Verifica le variabili d'ambiente
    const requiredEnvVars = [
      'OPENAI_API_KEY',
      'ASSISTANT_ID',
      'SLACK_BOT_TOKEN',
      'SLACK_CHANNEL_ID',
      'HUBSPOT_API_KEY'
    ];

    const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
    if (missingEnvVars.length > 0) {
      console.error('Variabili d\'ambiente mancanti:', missingEnvVars);
      return res.status(500).json({ 
        error: 'Configurazione server incompleta',
        missingVars: missingEnvVars
      });
    }
    
    if (!formData || !formData.email) {
      console.error('Dati del form mancanti o invalidi:', formData);
      return res.status(400).json({ 
        error: 'Dati del form mancanti o invalidi',
        receivedBody: formData
      });
    }

    // Genera una risposta con OpenAI
    console.log('Inizio generazione testo...');
    const qualificationText = await generateQualificationText(formData);
    console.log('Risposta generata:', qualificationText);

    // Invia su Slack
    console.log('Inizio invio su Slack...');
    await sendSlackMessage(formData, qualificationText);
    console.log('Messaggio inviato su Slack');

    // Invia email su HubSpot
    console.log('Inizio invio su HubSpot...');
    await sendHubSpotEmail(formData, qualificationText);
    console.log('Email inviata su HubSpot');

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Errore dettagliato:', {
      message: error.message,
      stack: error.stack,
      response: error.response?.data
    });
    res.status(500).json({ 
      error: error.message,
      details: error.response?.data || 'Nessun dettaglio aggiuntivo'
    });
  }
}

// funzione per generare il testo di qualifica
async function generateQualificationText(formData) {
  try {
    console.log('Generazione testo per:', formData.email);
    
    // Crea un nuovo thread per ogni richiesta
    const thread = await openai.beta.threads.create();
    console.log('Nuovo thread creato:', thread.id);

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

    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(message)
    });

    const data = await response.json();
    if (!data.ok) {
      throw new Error(`Errore Slack: ${data.error}`);
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
    const contactResponse = await fetch(
      `https://api.hubapi.com/crm/v3/objects/contacts/search?q=${encodeURIComponent(formData.email)}&properties=hs_object_id`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.HUBSPOT_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const contactData = await contactResponse.json();
    if (!contactData.results || contactData.results.length === 0) {
      throw new Error('Contatto non trovato');
    }

    const contactId = contactData.results[0].id;

    // Ora inviamo l'email
    const emailResponse = await fetch(
      'https://api.hubapi.com/crm/v3/objects/emails',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.HUBSPOT_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
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
        })
      }
    );

    if (!emailResponse.ok) {
      const errorData = await emailResponse.json();
      throw new Error(`Errore HubSpot: ${JSON.stringify(errorData)}`);
    }
  } catch (error) {
    console.error('errore invio hubspot:', error);
    throw error;
  }
} 