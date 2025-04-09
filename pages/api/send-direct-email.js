// Importa la funzione di invio email
import { sendGmailEmail } from './send-email';
import { sendHubSpotEmail } from './approve';

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

// Funzione per inviare una conferma a Slack
async function sendConfirmationToSlack(email) {
  try {
    const message = `✉️ *EMAIL INVIATA DIRETTAMENTE* - La risposta generata da AI è stata inviata a ${email} con successo.`;
    
    const result = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
      },
      body: JSON.stringify({
        channel: process.env.SLACK_CHANNEL_ID,
        text: message,
        unfurl_links: false
      }),
    });

    if (!result.ok) {
      throw new Error(`Errore Slack: ${result.statusText}`);
    }

    console.log('Conferma inviata a Slack');
    return result.json();
  } catch (error) {
    console.error('Errore nell\'invio della conferma a Slack:', error);
    // Non far fallire l'intera operazione se la conferma non viene inviata
  }
}

// Endpoint principale
export default async function handler(req, res) {
  // Abilita CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Gestisci preflight CORS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Ottieni i parametri dalla query
    const { message, email, id, saveToHubspot, formDetails } = req.query;

    // Verifica che ci siano tutti i parametri necessari
    if (!email || !email.includes('@')) {
      console.error('Email mancante o non valida:', email);
      return res.status(400).json({ error: 'Email mancante o non valida' });
    }

    if (!message) {
      console.error('Messaggio mancante');
      return res.status(400).json({ error: 'Messaggio mancante' });
    }

    console.log('Invio diretto email a:', email);
    console.log('Lunghezza messaggio:', message.length);

    // Se saveToHubspot è true, usa sendHubSpotEmail (che già include l'invio dell'email e l'aggiunta dei formDetails)
    if (saveToHubspot === 'true') {
      console.log('Salvataggio su Hubspot richiesto');
      // Non c'è bisogno di elaborare i formDetails qui, lo farà sendHubSpotEmail
      await sendHubSpotEmail(email, message, formDetails);
    } else {
      // Solo invio diretto email senza HubSpot
      console.log('Solo invio email senza HubSpot');
      
      // Prepara il messaggio con le informazioni di contesto
      let emailBody = message;
      
      // Se ci sono i dettagli del form, li aggiungiamo in fondo
      if (formDetails) {
        try {
          // Prova a decodificare l'URL se necessario
          let jsonStr = formDetails;
          if (typeof formDetails === 'string' && formDetails.includes('%')) {
            try {
              jsonStr = decodeURIComponent(formDetails);
            } catch (e) {
              console.error('Errore nella decodifica URL:', e);
            }
          }
          
          // Tenta di parsare il JSON
          const details = JSON.parse(jsonStr);
          emailBody += `\n\n------------------\n`;
          emailBody += `INFORMAZIONI RICHIESTA ORIGINALE:\n\n`;
          
          if (details.firstname || details.lastname) {
            emailBody += `Nome: ${details.firstname || ''} ${details.lastname || ''}\n`;
          }
          
          if (details.company) {
            emailBody += `Azienda: ${details.company}\n`;
          }
          
          if (details.project_type) {
            emailBody += `Tipo Progetto: ${details.project_type}\n`;
          }
          
          if (details.budget) {
            emailBody += `Budget: ${details.budget}\n`;
          }
          
          if (details.message) {
            emailBody += `\nMessaggio Originale:\n${details.message}\n`;
          }
          
        } catch (error) {
          console.error('Errore nel parsing dei dettagli del form:', error);
          console.error('formDetails ricevuto:', formDetails);
          // Continuiamo senza aggiungere i dettagli
        }
      }
      
      await sendGmailEmail(email, 'Grazie per averci contattato', emailBody);
    }

    // Invia una conferma su Slack
    await sendConfirmationToSlack(email);

    // Restituisci una pagina HTML di conferma
    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Email Inviata</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              margin: 0;
              padding: 20px;
              background-color: #f9fafb;
            }
            .container {
              background-color: white;
              padding: 40px;
              border-radius: 12px;
              box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
              text-align: center;
              max-width: 700px;
              width: 100%;
            }
            .success-icon {
              font-size: 64px;
              margin-bottom: 20px;
              color: #4caf50;
            }
            h1 {
              color: #2c3e50;
              margin-bottom: 20px;
              font-weight: 600;
            }
            .email-info {
              background-color: #f1f8e9;
              padding: 15px;
              border-radius: 8px;
              margin: 20px 0;
              text-align: left;
              overflow-wrap: break-word;
              border-left: 4px solid #8bc34a;
            }
            .button {
              display: inline-block;
              margin-top: 20px;
              padding: 12px 24px;
              background-color: #4CAF50;
              color: white;
              text-decoration: none;
              border-radius: 4px;
              font-weight: 500;
              transition: background-color 0.3s;
              border: none;
              cursor: pointer;
            }
            .button:hover {
              background-color: #43A047;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success-icon">✅</div>
            <h1>Email Inviata con Successo</h1>
            <p>La risposta è stata inviata direttamente al lead tramite Gmail API.</p>
            
            <div class="email-info">
              <p><strong>Email destinatario:</strong> ${email}</p>
            </div>
            
            <a href="https://app.slack.com" class="button">Torna a Slack</a>
          </div>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Errore nell\'invio dell\'email:', error);
    
    // Restituisci una pagina di errore
    res.setHeader('Content-Type', 'text/html');
    return res.status(500).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Errore Invio Email</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              margin: 0;
              padding: 20px;
              background-color: #f9fafb;
            }
            .container {
              background-color: white;
              padding: 40px;
              border-radius: 12px;
              box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
              text-align: center;
              max-width: 700px;
              width: 100%;
            }
            .error-icon {
              font-size: 64px;
              margin-bottom: 20px;
              color: #f44336;
            }
            h1 {
              color: #2c3e50;
              margin-bottom: 20px;
              font-weight: 600;
            }
            .error-details {
              background-color: #ffebee;
              padding: 15px;
              border-radius: 8px;
              margin: 20px 0;
              text-align: left;
              overflow-wrap: break-word;
              border-left: 4px solid #f44336;
            }
            .button {
              display: inline-block;
              margin-top: 20px;
              padding: 12px 24px;
              background-color: #607D8B;
              color: white;
              text-decoration: none;
              border-radius: 4px;
              font-weight: 500;
              transition: background-color 0.3s;
              border: none;
              cursor: pointer;
            }
            .button:hover {
              background-color: #546E7A;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="error-icon">❌</div>
            <h1>Errore nell'Invio Email</h1>
            <p>Si è verificato un errore durante l'invio dell'email.</p>
            
            <div class="error-details">
              <p><strong>Dettaglio errore:</strong> ${error.message}</p>
            </div>
            
            <a href="https://app.slack.com" class="button">Torna a Slack</a>
          </div>
        </body>
      </html>
    `);
  }
} 