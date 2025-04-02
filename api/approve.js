const { OpenAI } = require('openai');

// Funzione per inviare messaggio di conferma a Slack
async function sendApprovalConfirmationToSlack(email) {
  try {
    const message = `✅ *APPROVATO* - La risposta per ${email} è stata approvata e registrata in HubSpot`;
    
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

    console.log('Messaggio di conferma inviato a Slack');
    return result.json();
  } catch (error) {
    console.error('Errore nell\'invio della conferma a Slack:', error);
    // Non far fallire tutta l'approvazione se non riusciamo a inviare la conferma
  }
}

export default async function handler(req, res) {
  // Log della richiesta per debug
  console.log('Richiesta ricevuta su /api/approve');
  console.log('Query params:', req.query);
  console.log('Method:', req.method);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  
  // Abilita CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Gestisci preflight CORS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Estraggo i parametri dalla query
    const { email, message } = req.query;
    
    console.log('Parametri ricevuti:');
    console.log('- email:', typeof email, email ? 'presente' : 'mancante');
    console.log('- message:', typeof message, message ? 'presente' : 'mancante', message ? `(lunghezza: ${message.length})` : '');
    
    // Verifico che i parametri siano presenti
    if (!email || !message) {
      console.error('Parametri mancanti:', { email, message });
      
      // Restituisco una pagina HTML di errore invece di JSON
      res.setHeader('Content-Type', 'text/html');
      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Errore Parametri</title>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              body {
                font-family: Arial, sans-serif;
                margin: 0;
                padding: 20px;
                background-color: #f5f5f5;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
              }
              .container {
                background-color: white;
                padding: 30px;
                border-radius: 8px;
                box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
                max-width: 600px;
                text-align: center;
              }
              h1 {
                color: #e74c3c;
                margin-bottom: 20px;
              }
              p {
                color: #333;
                margin-bottom: 15px;
                line-height: 1.5;
              }
              .details {
                background-color: #f9f9f9;
                padding: 15px;
                border-radius: 4px;
                margin: 20px 0;
                text-align: left;
                overflow-wrap: break-word;
              }
              .button {
                display: inline-block;
                margin-top: 20px;
                padding: 10px 20px;
                background-color: #3498db;
                color: white;
                text-decoration: none;
                border-radius: 4px;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>Errore nei Parametri</h1>
              <p>Non è possibile approvare l'email perché mancano alcuni parametri necessari.</p>
              
              <div class="details">
                <p><strong>Parametri mancanti:</strong></p>
                ${!email ? '<p>• Email del destinatario</p>' : ''}
                ${!message ? '<p>• Messaggio da inviare</p>' : ''}
                
                <p><strong>Informazioni di debug:</strong></p>
                <p>URL: ${req.url}</p>
                <p>Query: ${JSON.stringify(req.query)}</p>
              </div>
              
              <p>Prova a tornare indietro e cliccare nuovamente sul pulsante "Approva e Registra" nel messaggio di Slack.</p>
              <a href="javascript:window.close()" class="button">Chiudi questa finestra</a>
            </div>
          </body>
        </html>
      `);
    }

    // Decodifico il messaggio se necessario
    let decodedMessage = message;
    if (typeof decodedMessage === 'string') {
      try {
        // Provo a decodificare il messaggio se sembra essere codificato
        if (decodedMessage.indexOf('%') >= 0) {
          decodedMessage = decodeURIComponent(decodedMessage);
        }
      } catch (decodeError) {
        console.error('Errore decodifica messaggio:', decodeError);
        // In caso di errore, mantengo il messaggio originale
      }
    }

    console.log('Approvazione ricevuta per:', email);
    console.log('Messaggio da inviare (lunghezza):', decodedMessage.length);

    // Invia l'email tramite HubSpot (crea un'attività)
    await sendHubSpotEmail(email, decodedMessage);
    
    // Invia messaggio di conferma a Slack
    await sendApprovalConfirmationToSlack(email);
    
    // Restituisci una pagina HTML di conferma
    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Email Approvata</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body {
              font-family: Arial, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
              background-color: #f5f5f5;
            }
            .container {
              background-color: white;
              padding: 40px;
              border-radius: 8px;
              box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
              text-align: center;
              max-width: 500px;
            }
            h1 {
              color: #333;
              margin-bottom: 20px;
            }
            .success-icon {
              color: #2ecc71;
              font-size: 48px;
              margin-bottom: 20px;
            }
            p {
              color: #666;
              line-height: 1.6;
            }
            .email-details {
              margin-top: 20px;
              padding: 15px;
              background-color: #f9f9f9;
              border-radius: 4px;
              text-align: left;
            }
            .button {
              display: inline-block;
              margin-top: 20px;
              padding: 10px 20px;
              background-color: #3498db;
              color: white;
              text-decoration: none;
              border-radius: 4px;
              transition: background-color 0.3s;
            }
            .button:hover {
              background-color: #2980b9;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success-icon">✓</div>
            <h1>Email Approvata e Registrata</h1>
            <p>L'email è stata approvata e registrata con successo per <strong>${email}</strong>.</p>
            <div class="email-details">
              <p><strong>Messaggio registrato:</strong></p>
              <p>${decodedMessage.replace(/\n/g, '<br>')}</p>
            </div>
            <a href="javascript:window.close()" class="button">Chiudi questa finestra</a>
          </div>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Errore durante l\'approvazione:', error);
    
    // Restituisco una pagina HTML di errore
    res.setHeader('Content-Type', 'text/html');
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Errore</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 20px;
              background-color: #f5f5f5;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
            }
            .container {
              background-color: white;
              padding: 30px;
              border-radius: 8px;
              box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
              max-width: 600px;
              text-align: center;
            }
            h1 {
              color: #e74c3c;
              margin-bottom: 20px;
            }
            p {
              color: #333;
              margin-bottom: 15px;
            }
            .error-details {
              background-color: #f9f9f9;
              padding: 15px;
              border-radius: 4px;
              margin: 20px 0;
              text-align: left;
              font-family: monospace;
              font-size: 14px;
              overflow-wrap: break-word;
            }
            .button {
              display: inline-block;
              margin-top: 20px;
              padding: 10px 20px;
              background-color: #3498db;
              color: white;
              text-decoration: none;
              border-radius: 4px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Si è verificato un errore</h1>
            <p>Non è stato possibile approvare l'email a causa di un errore interno.</p>
            
            <div class="error-details">
              <p><strong>Dettagli errore:</strong> ${error.message}</p>
            </div>
            
            <p>Prova a tornare indietro e riprovare. Se il problema persiste, contatta l'amministratore.</p>
            <a href="javascript:window.close()" class="button">Chiudi questa finestra</a>
          </div>
        </body>
      </html>
    `);
  }
}

// funzione per inviare email su HubSpot
async function sendHubSpotEmail(email, message) {
  try {
    console.log('Invio email a:', email);
    
    // Costruisci l'intestazione dell'email
    const oggetto = "Grazie per averci contattato";

    // Usa l'API di engagement di HubSpot per registrare l'attività email
    const engagementUrl = 'https://api.hubapi.com/engagements/v1/engagements';
    const engagementPayload = {
      engagement: {
        type: "EMAIL",
        timestamp: Date.now()
      },
      associations: {
        contactIds: []  // Verrà popolato dopo aver trovato il contatto
      },
      metadata: {
        from: {
          email: "hello@extendi.it",
          firstName: "Dario",
          lastName: "Calamandrei"
        },
        to: [{ email: email }],
        subject: oggetto,
        text: message
      }
    };
    
    // Prima troviamo il contatto tramite email
    const searchUrl = `https://api.hubapi.com/crm/v3/objects/contacts/search`;
    const searchBody = {
      filterGroups: [{
        filters: [{
          propertyName: "email",
          operator: "EQ",
          value: email
        }]
      }],
      properties: ["firstname", "lastname", "hs_object_id"]
    };
    
    const contactResponse = await fetch(searchUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.HUBSPOT_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(searchBody)
    });

    const contactData = await contactResponse.json();
    console.log('Risposta ricerca contatto:', JSON.stringify(contactData, null, 2));
    
    if (!contactData.results || contactData.results.length === 0) {
      throw new Error('Contatto non trovato');
    }

    const contact = contactData.results[0];
    const contactId = contact.id;
    
    console.log('Contatto trovato:', contactId);
    
    // Aggiorniamo l'associazione con l'ID del contatto
    engagementPayload.associations.contactIds = [parseInt(contactId)];
    
    // Inviamo l'engagement
    const engagementResponse = await fetch(engagementUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.HUBSPOT_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(engagementPayload)
    });
    
    // Verifichiamo la risposta
    if (!engagementResponse.ok) {
      const errorText = await engagementResponse.text();
      console.error('Risposta errore HubSpot:', errorText);
      
      // Piano B: se fallisce l'engagement, proviamo con una nota semplice
      const noteUrl = `https://api.hubapi.com/crm/v3/objects/notes`;
      const noteBody = {
        properties: {
          hs_note_body: `Email inviata a ${email}:\n\n${message}`,
          hs_timestamp: Date.now()
        }
      };
      
      // Creiamo la nota
      const noteResponse = await fetch(noteUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.HUBSPOT_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(noteBody)
      });
      
      if (!noteResponse.ok) {
        const noteErrorText = await noteResponse.text();
        console.error('Errore creazione nota:', noteErrorText);
        throw new Error(`Errore HubSpot: ${noteResponse.status} ${noteResponse.statusText}`);
      }
      
      const noteData = await noteResponse.json();
      console.log('Nota creata:', noteData.id);
      
      // Ora associamo la nota al contatto
      const noteId = noteData.id;
      const associationUrl = `https://api.hubapi.com/crm/v4/objects/notes/${noteId}/associations/contacts/${contactId}/note_to_contact`;
      
      const associationResponse = await fetch(associationUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${process.env.HUBSPOT_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!associationResponse.ok) {
        console.error('Errore nell\'associazione della nota');
      } else {
        console.log('Nota associata al contatto con successo');
      }
      
      return;
    }
    
    const engagementResult = await engagementResponse.json();
    console.log('Engagement creato:', engagementResult.id);
    
    return engagementResult;
  } catch (error) {
    console.error('Errore nell\'invio a HubSpot:', error);
    throw error;
  }
} 