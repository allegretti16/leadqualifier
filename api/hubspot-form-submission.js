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

    // Non inviamo più automaticamente l'email a HubSpot
    // L'email verrà inviata solo dopo l'approvazione tramite l'endpoint /api/approve

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
    
    const prompt = `
Sei un assistente di vendita esperto. Hai ricevuto un'email da un potenziale cliente che ha compilato un form di contatto.
Scrivi una risposta professionale, amichevole e personalizzata per qualificare il lead.
La risposta dovrebbe:
1. Essere in italiano
2. Ringraziare il cliente per aver contattato l'azienda
3. Confermare che hai ricevuto i dettagli del loro progetto
4. Menzionare specificamente il tipo di progetto e il budget (se forniti)
5. Spiegare brevemente i vantaggi della tua azienda per quel tipo di progetto
6. Chiedere se sarebbero disponibili per una breve chiamata per discutere ulteriormente dei dettagli
7. Firma come "Team Commerciale"

Ecco i dettagli del lead:
Nome: ${formData.firstname} ${formData.lastname}
Email: ${formData.email}
Azienda: ${formData.company}
Tipo Progetto: ${formData.project_type}
Budget: ${formData.budget}
Messaggio: ${formData.message}

Scrivi SOLO la risposta, senza aggiungere prefazioni o note.
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Sei un assistente di vendita esperto che qualifica i lead." },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 500
    });

    return response.choices[0].message.content.trim();
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
      text: `*Nuovo Lead Ricevuto*\n\n*Dettagli:*\nNome: ${formData.firstname} ${formData.lastname}\nEmail: ${formData.email}\nAzienda: ${formData.company}\nTipo Progetto: ${formData.project_type}\nBudget: ${formData.budget}\n\n*Messaggio:*\n${formData.message}\n\n*Risposta Generata:*\n${qualificationText}\n\n<https://leadqualifier.vercel.app/api/approve?email=${encodeURIComponent(formData.email)}&message=${encodeURIComponent(qualificationText)}|Approva e Invia>`
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