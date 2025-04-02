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

// Funzione per ricercare informazioni sull'azienda
async function getCompanyInfo(companyName) {
  try {
    if (!companyName || companyName.trim() === '') {
      return "Nessuna informazione disponibile (nome azienda non fornito)";
    }

    console.log('Ricerca informazioni per azienda:', companyName);
    
    const prompt = `
Sei un assistente che deve cercare informazioni su Google riguardo a "${companyName}".
Devi fare una ricerca su Google per trovare:

1. Il fatturato dell'azienda (cerca specificamente "fatturato ${companyName}" o "revenue ${companyName}")
2. Il numero di dipendenti dell'azienda
3. Il settore in cui opera l'azienda

Cerca questi dati sul web, idealmente da fonti come il sito ufficiale dell'azienda, LinkedIn, registri aziendali, o articoli finanziari.
Se l'azienda è italiana, cerca il fatturato in euro.

Dopo aver effettuato la ricerca, formatta la risposta come segue:
**${companyName}**
- Fatturato: [importo specifico che hai trovato, con l'anno se disponibile] 
- Dipendenti: [numero specifico o range]
- Settore: [settore principale]

Se non riesci a trovare informazioni specifiche su qualcuno di questi punti, scrivi "dati non disponibili".
Includi SOLO queste tre righe di informazioni, nient'altro.
`;

    const response = await openai.chat.completions.create({
      model: "o3-mini",
      messages: [
        {
          role: "system",
          content: "Sei un assistente esperto nella ricerca di informazioni aziendali su Google. Devi cercare dati fattuali sulle aziende dal web, in particolare fatturato, dipendenti e settore. Se non riesci a trovare dati esatti, devi indicarlo chiaramente."
        },
        { role: "user", content: prompt }
      ],
      temperature: 0.3,
      max_completation_tokens: 300
    });

    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error('Errore nella ricerca delle informazioni aziendali:', error);
    return "Ricerca informazioni aziendali non riuscita. Dati non disponibili.";
  }
}

// Funzione per inviare messaggi a Slack
async function sendMessageToSlack(formData, qualificationText, companyInfo) {
  try {
    // Ottieni dominio di base per costruire gli URL
    let baseUrl;
    
    // In locale, usa localhost
    if (process.env.NODE_ENV === 'development') {
      baseUrl = 'http://localhost:3000';
    } 
    // In produzione, usa l'URL di Vercel o quello personalizzato
    else if (process.env.VERCEL_URL) {
      baseUrl = `https://${process.env.VERCEL_URL}`;
    } 
    // Fallback all'URL hardcoded se non ci sono alternative
    else {
      baseUrl = 'https://leadqualifier.vercel.app';
    }
    
    console.log('URL base utilizzato:', baseUrl);

    // IMPORTANTE: Verifica che l'email sia presente nei dati
    if (!formData.email) {
      console.error('Email mancante nei dati del form');
      throw new Error('Email mancante nei dati del form');
    }

    // Salva temporaneamente il testo in una variabile globale con ID univoco
    // Nota: in un ambiente di produzione reale, si dovrebbe usare un database
    // per memorizzare questi dati invece di variabili globali
    const messageId = Date.now().toString();
    global[`message_${messageId}`] = qualificationText;

    // Usa URL più brevi con solo l'ID del messaggio e l'email
    const editUrl = `${baseUrl}/api/edit-message?id=${messageId}&email=${encodeURIComponent(formData.email)}`;
    const approveUrl = `${baseUrl}/api/approve?id=${messageId}&email=${encodeURIComponent(formData.email)}`;

    // Log per debug
    console.log('Email usata nell\'URL:', formData.email);
    console.log('ID messaggio generato:', messageId);
    console.log('Lunghezza messaggio originale:', qualificationText.length);
    console.log('Edit URL generato:', editUrl);
    console.log('Approve URL generato:', approveUrl);

    // Blocchi per il messaggio Slack
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
          text: "*Informazioni aziendali:*\n" + companyInfo,
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
              text: "✅ Approva e Registra",
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

    // Avvia in parallelo la generazione del testo e la ricerca delle informazioni aziendali
    // Utilizziamo Promise.all per eseguire entrambe le chiamate contemporaneamente
    const [qualificationText, companyInfo] = await Promise.all([
      generateQualificationText(formData),
      getCompanyInfo(formData.company)
    ]);
    
    console.log('Testo generato:', qualificationText);
    console.log('Informazioni aziendali:', companyInfo);

    // Invia il messaggio a Slack con i link di approvazione, modifica e le informazioni aziendali
    await sendMessageToSlack(formData, qualificationText, companyInfo);

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