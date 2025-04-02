const { OpenAI } = require('openai');

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
async function sendMessageToSlack(formData, qualificationText) {
  try {
    // Costruzione più flessibile dell'URL di base
    let baseUrl;
    if (process.env.VERCEL_URL) {
      // URL di produzione su Vercel
      baseUrl = `https://${process.env.VERCEL_URL}`;
    } else if (process.env.NEXT_PUBLIC_SITE_URL) {
      // URL personalizzato definito in variabili d'ambiente
      baseUrl = process.env.NEXT_PUBLIC_SITE_URL;
    } else if (process.env.NODE_ENV === 'development') {
      // Ambiente di sviluppo locale, solitamente su localhost:3000
      baseUrl = 'http://localhost:3000';
    } else {
      // Fallback all'URL hardcoded
      baseUrl = 'https://leadqualifier.vercel.app';
    }

    console.log('URL base utilizzato:', baseUrl);

    // Codifica sicura dei parametri URL - doppia codifica per evitare problemi con caratteri speciali
    const safeEmail = encodeURIComponent(formData.email);
    const safeMessage = encodeURIComponent(qualificationText);
    
    // Per sicurezza, limito la lunghezza del messaggio nell'URL a 1500 caratteri
    const truncatedMessage = safeMessage.length > 1500 ? safeMessage.substring(0, 1500) + '...' : safeMessage;

    const editUrl = `${baseUrl}/api/edit?email=${safeEmail}&originalMessage=${truncatedMessage}`;
    const approveUrl = `${baseUrl}/api/approve?email=${safeEmail}&message=${truncatedMessage}`;

    // Log degli URL per debug
    console.log('Email codificata:', safeEmail);
    console.log('Lunghezza messaggio originale:', qualificationText.length);
    console.log('Lunghezza messaggio codificato:', safeMessage.length);
    console.log('Lunghezza messaggio troncato:', truncatedMessage.length);
    console.log('Edit URL:', editUrl);
    console.log('Approve URL:', approveUrl);

    const blocks = [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Nuovo lead da qualificare*\n\n*Dettagli:*\nNome: ${formData.firstname} ${formData.lastname}\nEmail: ${formData.email}\nAzienda: ${formData.company}\nTipo Progetto: ${formData.project_type}\nBudget: ${formData.budget}`,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*Messaggio originale:*\n" + formData.message,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*Risposta Generata:*\n```" + qualificationText + "```",
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
            url: editUrl,
          },
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "Approva e Registra",
              emoji: true,
            },
            style: "primary",
            url: approveUrl,
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
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  // Abilita CORS per tutti gli altri metodi
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
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

    // Invia il messaggio a Slack con i link di approvazione e modifica
    await sendMessageToSlack(formData, qualificationText);

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