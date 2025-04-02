const { OpenAI } = require('openai');
const crypto = require('crypto');

// Archivio temporaneo per tenere traccia dei link approvati
// Nota: su Vercel questo sarà resettato ad ogni deploy
const approvedTokens = new Set();
const pendingMessages = new Map();

// Inizializza OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// funzione per generare il testo di qualifica
async function generateQualificationText(formData) {
  try {
    console.log('Generazione testo per:', formData.email);
    
    const prompt = `
Sei il Sales Manager di Extendi, il tuo nome è Dario Calamandrei. Extendi S.r.l. è un'azienda italiana che offre soluzioni tecnologiche complesse, applicazioni web e strumenti di analisi dei big data con un design centrato sull'utente. Fondata nel 2005, Extendi ha oltre 15 anni di esperienza e più di 30 sviluppatori specializzati in Ruby on Rails e React/React Native. Ha anche un team di UX/UI desingers. La loro profonda conoscenza di strumenti moderni come Gatsby e Next.js li rende una delle migliori agenzie in Europa per lo sviluppo di applicazioni mission-critical. Utilizzano l'architettura Jamstack, che si basa sui principi del pre-rendering dell'intero front-end e del disaccoppiamento del front-end dal back-end. Questo approccio consente di gestire picchi di traffico, ottimizzare l'SEO, migliorare le conversioni dell'e-commerce e garantire un uptime elevato. Inoltre, Extendi si impegna a consegnare progetti puntuali e di alta qualità, collaborando con grandi aziende e aiutando startup a crescere. Per ulteriori informazioni, puoi visitare il loro sito web. Il tuo obiettivo è qualificare i clienti che scrivono alla mail hello@extendi.it, rispondendo alla mail con una serie di domande pertinenti alle esigenze specifiche del cliente ma anche finalizzate a comprendere il budget che ha a disposizione qualora non sia specificato o se sia meno di 30k capire quanto effettivamente sia al disotto di 30k€
  
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

// Funzione per inviare messaggi a Slack
async function sendMessageToSlack(message, approvalLink, editLink, email) {
  try {
    const blocks = [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Nuovo lead da qualificare:* ${email}`,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "```" + message + "```",
        },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "Modifica",
              emoji: true,
            },
            style: "primary",
            url: editLink,
          },
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "Approva e Invia",
              emoji: true,
            },
            style: "primary",
            url: approvalLink,
          },
        ],
      },
    ];

    const result = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
      },
      body: JSON.stringify({
        channel: process.env.SLACK_CHANNEL_ID,
        blocks: blocks,
      }),
    });

    if (!result.ok) {
      throw new Error(`Errore Slack: ${result.statusText}`);
    }

    return result.json();
  } catch (error) {
    console.error("Errore nell'invio a Slack:", error);
    throw error;
  }
}

// Funzione principale
export default async function handler(req, res) {
  // Gestisci preflight CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  // Abilita CORS per tutti gli altri metodi
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    // Gestisci la richiesta PUT per aggiornare il messaggio in sospeso
    if (req.method === 'PUT') {
      const { token } = req.query;
      
      if (!token || !pendingMessages.has(token)) {
        return res.status(404).json({ error: 'Token non valido o scaduto' });
      }
      
      if (approvedTokens.has(token)) {
        return res.status(400).json({ error: 'Questo messaggio è già stato approvato' });
      }
      
      // Ottieni il messaggio aggiornato dalla richiesta
      let updatedData;
      try {
        updatedData = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      } catch (e) {
        return res.status(400).json({ error: 'Formato dati non valido' });
      }
      
      if (!updatedData.message) {
        return res.status(400).json({ error: 'Messaggio mancante' });
      }
      
      // Aggiorna il messaggio in sospeso
      const pendingData = pendingMessages.get(token);
      pendingData.message = updatedData.message;
      pendingMessages.set(token, pendingData);
      
      return res.status(200).json({ success: true, message: 'Messaggio aggiornato con successo' });
    }

    // Gestisci la richiesta GET per verificare lo stato del token
    if (req.method === 'GET') {
      // Controlla se è una richiesta di verifica per un token
      const { token } = req.query;
      
      if (token) {
        if (approvedTokens.has(token)) {
          return res.status(200).json({ 
            status: 'already_approved', 
            message: 'Questa email è già stata approvata e inviata.' 
          });
        } else if (pendingMessages.has(token)) {
          return res.status(200).json({ 
            status: 'pending', 
            message: pendingMessages.get(token) 
          });
        } else {
          return res.status(404).json({ 
            status: 'not_found', 
            message: 'Token non valido o scaduto.' 
          });
        }
      }
      
      return res.status(400).json({ error: 'Richiesta non valida' });
    }

    // Verifica che ci siano i dati richiesti per POST
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Metodo non consentito' });
    }

    // Log delle intestazioni e del corpo della richiesta
    console.log('Headers:', req.headers);
    console.log('Body:', req.body);

    // Estrai il corpo della richiesta
    let formData;
    try {
      if (typeof req.body === 'string') {
        formData = JSON.parse(req.body);
      } else {
        formData = req.body;
      }
    } catch (error) {
      console.error('Errore nel parsing del corpo:', error);
      return res.status(400).json({ error: 'Corpo della richiesta non valido' });
    }

    // Verifica che ci sia almeno l'email
    if (!formData.email) {
      return res.status(400).json({ error: 'Email richiesta nel body' });
    }

    console.log('Richiesta ricevuta per:', formData.email);

    // Genera il testo di qualifica utilizzando OpenAI
    const qualificationText = await generateQualificationText(formData);
    console.log('Testo generato:', qualificationText);

    // Genera un token unico per questa richiesta
    const token = crypto.randomBytes(16).toString('hex');
    
    // Salva il messaggio in sospeso
    pendingMessages.set(token, {
      email: formData.email,
      message: qualificationText,
      formData: formData,
      timestamp: Date.now()
    });

    // Crea i link per l'approvazione e la modifica
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'https://leadqualifier.vercel.app';
    
    const approvalLink = `${baseUrl}/api/approve?token=${token}`;
    const editLink = `${baseUrl}/api/edit?token=${token}`;

    // Invia il messaggio a Slack con i link di approvazione e modifica
    await sendMessageToSlack(qualificationText, approvalLink, editLink, formData.email);

    // Restituisci una risposta di successo
    return res.status(200).json({
      success: true,
      message: 'Messaggio inviato a Slack per approvazione',
    });
  } catch (error) {
    console.error('Errore nella gestione della richiesta:', error);
    return res.status(500).json({ error: error.message });
  }
} 