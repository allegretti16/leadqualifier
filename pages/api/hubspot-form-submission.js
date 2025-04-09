const { OpenAI } = require('openai');
// Funzione helper per ottenere l'URL base
function getBaseUrl() {
    if (process.env.NODE_ENV === 'development') {
      return 'http://localhost:3000';
    } else if (process.env.VERCEL_URL) {
      return `https://${process.env.VERCEL_URL}`;
    } else {
      return 'https://leadqualifier.vercel.app';
    }
  }
  
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
      // Ottieni dominio di base per costruire gli URL
      const baseUrl = getBaseUrl();
      
      console.log('URL base utilizzato:', baseUrl);
  
      // IMPORTANTE: Verifica che l'email sia presente nei dati
      if (!formData.email) {
        console.error('Email mancante nei dati del form');
        throw new Error('Email mancante nei dati del form');
      }
  
      // Genera un ID univoco per il messaggio
      const messageId = Date.now().toString();
  
      // Crea un oggetto con i dettagli del form che vogliamo passare
      const formDetails = {
        firstname: formData.firstname || '',
        lastname: formData.lastname || '',
        company: formData.company || '',
        project_type: formData.project_type || '',
        budget: formData.budget || '',
        message: formData.message || ''
      };
      
      console.log('Form Details creati:', formDetails);
      
      // Salva il messaggio in Supabase
      try {
        await saveMessage({
          id: messageId,
          email: formData.email,
          message: qualificationText,
          formDetails: JSON.stringify(formDetails),
          originalMessage: formData.message
        });
        console.log('Messaggio salvato con successo in Supabase');
      } catch (error) {
        console.error('Errore nel salvataggio del messaggio in Supabase:', error);
        throw error;
      }
      
      // Crea l'URL della pagina intermedia che salverà il messaggio in Supabase
      const saveUrl = `${baseUrl}/api/approve?id=${messageId}&email=${encodeURIComponent(formData.email)}&skipHubspot=true`;
      
      // Crea l'URL per inviare direttamente l'email e salvare su Hubspot
      const sendEmailUrl = `${baseUrl}/api/approve?id=${messageId}&email=${encodeURIComponent(formData.email)}&skipHubspot=false`;
      
      console.log('URL Invia e salva costruito:', sendEmailUrl);
  
      // Log per debug
      console.log('Email usata nell\'URL:', formData.email);
      console.log('ID messaggio generato:', messageId);
      console.log('Lunghezza messaggio originale:', qualificationText.length);
  
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
                text: "✏️ Modifica e Invia",
                emoji: true,
              },
              style: "primary",
              url: saveUrl,
            },
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "📩 Invia e Salva su Hubspot",
                emoji: true,
              },
              style: "danger",
              url: sendEmailUrl,
            }
          ],
        }
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
  
    // Endpoint di test speciale
    if (req.query.test === 'true') {
      return testHandler(req, res);
    }
  
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
      
      // Debug del valore company
      console.log('Company nei dati del form:', formData.company, 'Tipo:', typeof formData.company);
      
      // Avvia la generazione del testo
      const qualificationText = await generateQualificationText(formData);
      
      console.log('Testo generato:', qualificationText);
  
      // Invia il messaggio a Slack con i link di approvazione
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
  
  // Funzione di test
  function testHandler(req, res) {
    return res.status(200).json({ message: 'Test endpoint funzionante' });
  }
  
  // Esporta la funzione di test per utilizzo diretto da altri moduli
  export { testHandler }; 