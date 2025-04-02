const { OpenAI } = require('openai');

// Questo array deve essere sincronizzato con lo stesso array in hubspot-form-submission.js
// Nota: su Vercel sarà resettato ad ogni deploy se non usi un database
const approvedTokens = new Set();
const pendingMessages = new Map();

export default async function handler(req, res) {
  // Abilita CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  try {
    const { token, message } = req.query;
    
    if (!token) {
      return res.status(400).json({ error: 'Token richiesto' });
    }

    // Per richieste POST, assumiamo che sia un submit del form
    if (req.method === 'POST') {
      // Controlla se il token è valido
      if (!pendingMessages.has(token)) {
        return res.status(404).json({ error: 'Token non valido o scaduto' });
      }

      // Se il token è già stato approvato
      if (approvedTokens.has(token)) {
        return res.status(400).json({ error: 'Email già approvata e inviata' });
      }

      // Ottieni il messaggio modificato dal corpo della richiesta
      let messageData;
      try {
        messageData = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      } catch (e) {
        return res.status(400).json({ error: 'Formato dati non valido' });
      }

      // Esegui l'invio a HubSpot
      const pendingData = pendingMessages.get(token);
      
      // Usa il messaggio modificato invece di quello originale
      const updatedMessage = messageData.message || pendingData.message;
      
      console.log('Approvazione ricevuta per:', pendingData.email);
      console.log('Messaggio da inviare:', updatedMessage);

      // Invia l'email tramite HubSpot (crea un'attività)
      await sendHubSpotEmail(pendingData.email, updatedMessage);
      
      // Segna questo token come approvato
      approvedTokens.add(token);
      
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
              <p>L'email è stata approvata e registrata con successo per <strong>${pendingData.email}</strong>.</p>
              <div class="email-details">
                <p><strong>Messaggio registrato:</strong></p>
                <p>${updatedMessage.replace(/\n/g, '<br>')}</p>
              </div>
              <a href="javascript:window.close()" class="button">Chiudi questa finestra</a>
            </div>
          </body>
        </html>
      `);
      
      return;
    }

    // Per richieste GET, mostra la pagina di modifica/approvazione
    // Controlla se il token è valido
    if (!pendingMessages.has(token)) {
      return res.status(404).json({ error: 'Token non valido o scaduto' });
    }

    // Se il token è già stato approvato
    if (approvedTokens.has(token)) {
      res.setHeader('Content-Type', 'text/html');
      res.status(200).send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Email Già Approvata</title>
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
              .info-icon {
                color: #3498db;
                font-size: 48px;
                margin-bottom: 20px;
              }
              p {
                color: #666;
                line-height: 1.6;
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
              <div class="info-icon">ℹ️</div>
              <h1>Email Già Approvata</h1>
              <p>Questa email è già stata approvata e registrata. Non è possibile approvarla nuovamente.</p>
              <a href="javascript:window.close()" class="button">Chiudi questa finestra</a>
            </div>
          </body>
        </html>
      `);
      return;
    }

    // Ottieni i dati del messaggio in sospeso
    const pendingData = pendingMessages.get(token);
    
    // Mostra il form di modifica/approvazione
    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Approva Email</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 20px;
              background-color: #f5f5f5;
            }
            .container {
              background-color: white;
              padding: 20px;
              border-radius: 8px;
              box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
              max-width: 800px;
              margin: 0 auto;
            }
            h1 {
              color: #333;
              margin-bottom: 20px;
            }
            .field {
              margin-bottom: 20px;
            }
            label {
              display: block;
              margin-bottom: 5px;
              font-weight: bold;
              color: #555;
            }
            input[disabled] {
              background-color: #f9f9f9;
            }
            input, textarea {
              width: 100%;
              padding: 10px;
              border: 1px solid #ddd;
              border-radius: 4px;
              font-size: 16px;
              font-family: inherit;
            }
            textarea {
              min-height: 300px;
              resize: vertical;
            }
            .buttons {
              display: flex;
              justify-content: flex-end;
              gap: 10px;
              margin-top: 20px;
            }
            button {
              padding: 10px 20px;
              background-color: #3498db;
              color: white;
              border: none;
              border-radius: 4px;
              cursor: pointer;
              font-size: 16px;
              transition: background-color 0.3s;
            }
            button:hover {
              background-color: #2980b9;
            }
            button.approve {
              background-color: #2ecc71;
            }
            button.approve:hover {
              background-color: #27ae60;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Approva Email</h1>
            <form id="approval-form">
              <div class="field">
                <label for="email">Email Destinatario:</label>
                <input type="email" id="email" value="${pendingData.email}" disabled>
              </div>
              <div class="field">
                <label for="subject">Oggetto:</label>
                <input type="text" id="subject" value="Grazie per averci contattato" disabled>
              </div>
              <div class="field">
                <label for="message">Messaggio:</label>
                <textarea id="message">${pendingData.message}</textarea>
              </div>
              <div class="buttons">
                <button type="button" onclick="window.close()">Annulla</button>
                <button type="button" class="approve" onclick="approveEmail()">Approva e Registra</button>
              </div>
            </form>
          </div>

          <script>
            function approveEmail() {
              const message = document.getElementById('message').value;
              
              fetch(window.location.href, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  message: message
                })
              })
              .then(response => {
                if (response.ok) {
                  // Reload the page to show the confirmation
                  window.location.reload();
                } else {
                  alert('Si è verificato un errore durante l\'approvazione. Riprova più tardi.');
                }
              })
              .catch(error => {
                alert('Si è verificato un errore: ' + error.message);
              });
            }
          </script>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Errore durante l\'approvazione:', error);
    res.status(500).json({ error: 'Errore durante l\'invio dell\'email' });
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