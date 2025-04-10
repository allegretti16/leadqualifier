import { sendGmailEmail } from './send-email';
import { getMessage, updateMessage } from '../../utils/supabase';
import { authMiddleware } from '../../middleware/authMiddleware';
import { supabaseAdmin } from '../../utils/supabase';

// Funzione per inviare messaggio di conferma a Slack
async function sendApprovalConfirmationToSlack(email) {
  try {
    const message = `✅ *SALVATA E INVIATA* - La risposta per ${email} è stata inviata e registrata in HubSpot`;
    
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
  }
}

// Funzione helper per ottenere l'URL base
function getBaseUrl(req) {
  // Verifica prima se c'è un header di origine
  const origin = req.headers.origin || '';
  if (origin && origin.includes('leadqualifier')) {
    return origin;
  }
  
  // Altrimenti usa la logica standard
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3000';
  } else {
    return 'https://leadqualifier.vercel.app';
  }
}

// Handler principale
async function baseHandler(req, res) {
  // Gestisci preflight CORS
  if (req.method === 'OPTIONS') {
    // Permetti l'origine della richiesta
    const origin = req.headers.origin || '*';
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    return res.status(200).end();
  }

  // Imposta gli header CORS per tutte le altre richieste
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  try {
    // Estrai i parametri dalla richiesta (supporta sia GET che POST)
    let params;
    if (req.method === 'POST') {
      params = req.body || {};
    } else {
      params = req.query || {};
    }
    
    // Ottieni i parametri dalla richiesta
    const { id, email, skipHubspot, modifiedMessage } = params;
    
    // Verifica che l'ID sia presente
    if (!id) {
      return res.status(400).json({ error: 'ID messaggio mancante' });
    }

    // Recupera il messaggio da Supabase
    let messageData;
    try {
      messageData = await getMessage(id);
      if (!messageData) {
        throw new Error('Messaggio non trovato');
      }
    } catch (error) {
      console.error('Errore nel recupero del messaggio:', error);
      return res.status(500).json({ error: 'Errore nel recupero del messaggio' });
    }

    // Verifica che l'email corrisponda
    if (messageData.email !== email) {
      return res.status(400).json({ error: 'Email non corrispondente' });
    }

    // Usa il messaggio modificato se presente, altrimenti quello salvato
    const messageToUse = modifiedMessage || messageData.message_text;

    // Se skipHubspot è presente e non false, mostra la pagina di modifica
    if (skipHubspot !== 'false' && skipHubspot !== false) {
      // Ottieni l'URL base esatto dalla richiesta attuale
      const currentBaseUrl = getBaseUrl(req);
      
      res.setHeader('Content-Type', 'text/html');
      return res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Modifica Messaggio</title>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                margin: 0;
                padding: 20px;
                background-color: #f9fafb;
              }
              .container {
                background-color: white;
                padding: 40px;
                border-radius: 12px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
                max-width: 800px;
                margin: 0 auto;
              }
              h1 {
                color: #2c3e50;
                margin-bottom: 20px;
                font-weight: 600;
                text-align: center;
              }
              .email-info {
                background-color: #e3f2fd;
                padding: 15px;
                border-radius: 8px;
                margin: 20px 0;
                border-left: 4px solid #2196f3;
              }
              textarea {
                width: 100%;
                height: 300px;
                padding: 12px;
                border: 1px solid #ddd;
                border-radius: 4px;
                font-family: inherit;
                font-size: 14px;
                line-height: 1.6;
              }
              .button-group {
                display: flex;
                justify-content: center;
                gap: 15px;
                margin-top: 30px;
              }
              .button {
                padding: 12px 24px;
                background-color: #4CAF50;
                color: white;
                text-decoration: none;
                border-radius: 4px;
                font-weight: 500;
                border: none;
                cursor: pointer;
              }
              .button-secondary {
                background-color: #607D8B;
              }
              .button:hover {
                opacity: 0.9;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>Modifica il messaggio prima di salvarlo</h1>
              <div class="email-info">
                <p><strong>Email destinatario:</strong> ${email}</p>
              </div>
              <textarea id="messageText">${messageToUse}</textarea>
              <div class="button-group">
                <button onclick="saveToHubspot()" class="button">Salva su HubSpot e invia email</button>
                <button onclick="window.close()" class="button button-secondary">Annulla</button>
              </div>
            </div>
            
            <script>
              // Usiamo lo stesso URL della richiesta corrente
              const baseUrl = window.location.origin;
              const apiPath = window.location.pathname;
              
              function saveToHubspot() {
                const modifiedText = document.getElementById('messageText').value;
                
                fetch(baseUrl + apiPath, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                  },
                  body: JSON.stringify({
                    id: "${id}",
                    email: "${email}",
                    modifiedMessage: modifiedText,
                    skipHubspot: false,
                    fromSlack: true
                  })
                })
                .then(response => {
                  if (!response.ok) {
                    throw new Error('Errore nella richiesta');
                  }
                  return response.text();
                })
                .then(html => {
                  document.open();
                  document.write(html);
                  document.close();
                })
                .catch(error => {
                  alert('Errore durante il salvataggio: ' + error.message);
                });
              }
            </script>
          </body>
        </html>
      `);
    }

    // Se siamo qui, dobbiamo salvare su HubSpot
    try {
      // Prima aggiorniamo lo stato del messaggio
      await updateMessage(id, {
        status: 'approved',
        approved_at: new Date().toISOString()
      });

      // Poi inviamo l'email
      await sendGmailEmail(email, "Grazie per averci contattato", messageToUse);
      
      // Invia conferma a Slack
      await sendApprovalConfirmationToSlack(email);

      // Restituisci la pagina di conferma
      res.setHeader('Content-Type', 'text/html');
      return res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Email Inviata</title>
            <style>
              body {
                font-family: Arial, sans-serif;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                margin: 0;
                background-color: #f0f2f5;
              }
              .container {
                text-align: center;
                padding: 2rem;
                background: white;
                border-radius: 8px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              }
              .success-icon {
                font-size: 48px;
                color: #4CAF50;
                margin-bottom: 1rem;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="success-icon">✅</div>
              <h1>Email Inviata con Successo</h1>
              <p>L'email è stata inviata a: ${email}</p>
              <button onclick="window.close()">Chiudi</button>
            </div>
          </body>
        </html>
      `);
    } catch (error) {
      console.error('Errore durante il processo di approvazione:', error);
      return res.status(500).json({ error: error.message });
    }
  } catch (error) {
    console.error('Errore nella gestione della richiesta:', error);
    return res.status(500).json({ error: error.message });
  }
}

// Wrapper che controlla se la richiesta viene da Slack
function handler(req, res) {
  // Se la richiesta ha il parametro fromSlack, bypassa l'autenticazione
  if (req.query.fromSlack === 'true') {
    return baseHandler(req, res);
  }
  
  // Altrimenti usa il middleware di autenticazione
  return authMiddleware(baseHandler)(req, res);
}

export default handler;

// funzione per inviare email su HubSpot
export async function sendHubSpotEmail(email, message, formDetailsString) {
  try {
    console.log('Invio email a:', email);
    console.log('formDetailsString tipo:', typeof formDetailsString);
    console.log('Valore completo formDetailsString:', formDetailsString);
    
    // Costruisci l'intestazione dell'email
    const oggetto = "Grazie per averci contattato";

    // Prepara il corpo dell'email con le informazioni di contesto
    let emailBody = message;
    
    // Se ci sono i dettagli del form, li aggiungiamo in fondo
    if (formDetailsString) {
      try {
        // Verifica il tipo di formDetailsString e gestisci tutti i casi possibili
        let formDetailsObj;
        
        if (typeof formDetailsString === 'object' && formDetailsString !== null) {
          // Già un oggetto
          formDetailsObj = formDetailsString;
          console.log('FormDetails è già un oggetto:', formDetailsObj);
        } else if (typeof formDetailsString === 'string') {
          // Stringa JSON o stringa URL-encoded
          let jsonStr = formDetailsString;
          console.log('FormDetails è una stringa, lunghezza:', formDetailsString.length);
          
          // Se è una stringa URL-encoded, decodificala
          if (formDetailsString.includes('%')) {
            try {
              console.log('Provo a decodificare URL-encoded string...');
              jsonStr = decodeURIComponent(formDetailsString);
              console.log('Stringa decodificata con successo, lunghezza:', jsonStr.length);
            } catch (e) {
              console.error('Errore nella decodifica URL:', e);
            }
          }
          
          // Tenta di parsare il JSON
          try {
            console.log('Provo a parsare il JSON...');
            formDetailsObj = JSON.parse(jsonStr);
            console.log('JSON parsato con successo:', formDetailsObj);
          } catch (e) {
            console.error('Errore nel parsing JSON:', e);
            console.error('Contenuto che ha causato errore:', jsonStr);
            // Fallback di sicurezza
            formDetailsObj = {};
          }
        } else {
          // Fallback per altri casi
          console.log('FormDetails non è né un oggetto né una stringa:',
                      typeof formDetailsString);
          formDetailsObj = {};
        }
        
        // Assicuriamoci che formDetailsObj sia un oggetto valido
        if (formDetailsObj && typeof formDetailsObj === 'object') {
          emailBody += `\n\n------------------\n`;
          emailBody += `INFORMAZIONI RICHIESTA ORIGINALE:\n\n`;
          
          if (formDetailsObj.firstname || formDetailsObj.lastname) {
            emailBody += `Nome: ${formDetailsObj.firstname || ''} ${formDetailsObj.lastname || ''}\n`;
          }
          
          if (formDetailsObj.company) {
            emailBody += `Azienda: ${formDetailsObj.company}\n`;
          }
          
          if (formDetailsObj.project_type) {
            emailBody += `Tipo Progetto: ${formDetailsObj.project_type}\n`;
          }
          
          if (formDetailsObj.budget) {
            emailBody += `Budget: ${formDetailsObj.budget}\n`;
          }
          
          if (formDetailsObj.message) {
            emailBody += `\nMessaggio Originale:\n${formDetailsObj.message}\n`;
          }
        }
        
      } catch (error) {
        console.error('Errore nel parsing dei dettagli del form:', error);
        console.error('Dettagli ricevuti:', formDetailsString);
        // Continuiamo senza aggiungere i dettagli
      }
    }

    // Invia prima l'email tramite Gmail API
    await sendGmailEmail(email, oggetto, emailBody);
    
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
        text: emailBody
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
    
    // Aggiorniamo l'associazione con l'ID del contatto come stringa
    engagementPayload.associations.contactIds = [contactId];
    
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
          hs_note_body: `Email inviata a ${email}:\n\n${emailBody}`,
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
      const associationUrl = `https://api.hubapi.com/crm/v3/objects/notes/${noteId}/associations/contacts/${contactId}`;
      
      const associationResponse = await fetch(associationUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${process.env.HUBSPOT_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!associationResponse.ok) {
        const associationErrorText = await associationResponse.text();
        console.error('Errore associazione nota:', associationErrorText);
        throw new Error(`Errore HubSpot: ${associationResponse.status} ${associationResponse.statusText}`);
      }
      
      console.log('Nota associata al contatto con successo');
    }
    
    console.log('Email inviata e registrata in HubSpot con successo');
  } catch (error) {
    console.error('Errore nell\'invio dell\'email:', error);
    throw error;
  }
}