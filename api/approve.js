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
    let { email, id, modifiedMessage, skipHubspot } = req.query;
    
    console.log('Parametri ricevuti:');
    console.log('- email:', typeof email, email ? 'presente' : 'mancante');
    console.log('- id:', typeof id, id ? 'presente' : 'mancante');
    console.log('- modifiedMessage:', typeof modifiedMessage, modifiedMessage ? 'presente (lunghezza: ' + modifiedMessage.length + ')' : 'mancante');
    console.log('- skipHubspot:', skipHubspot);
    
    // Recupera il messaggio
    let message;
    
    // Se è stato fornito un messaggio modificato direttamente, utilizziamo quello
    if (modifiedMessage) {
      try {
        message = decodeURIComponent(modifiedMessage);
        console.log('Utilizzo messaggio modificato fornito nell\'URL');
      } catch (decodeError) {
        console.error('Errore decodifica messaggio modificato:', decodeError);
      }
    }
    
    // Se non abbiamo ancora un messaggio valido e c'è un ID, prova a recuperare dalla variabile globale
    if (!message && id) {
      message = global[`message_${id}`];
      console.log('Recupero messaggio da ID:', id);
      console.log('Messaggio trovato nella variabile globale:', message ? 'Sì (lunghezza: ' + message.length + ')' : 'No');
    }

    // Ottieni l'URL base corrente per i link
    const baseUrl = getBaseUrl();

    // Se non abbiamo un messaggio ma abbiamo un ID, mostriamo una pagina di recupero che utilizzerà localStorage
    if (!message && id) {
      console.log('Messaggio non trovato in memoria, tentativo di recupero da localStorage');
      
      res.setHeader('Content-Type', 'text/html');
      return res.status(200).send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Recupero Messaggio</title>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                margin: 0;
                padding: 20px;
                background-color: #f9fafb;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
              }
              .container {
                background-color: white;
                padding: 40px;
                border-radius: 12px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
                max-width: 600px;
                width: 100%;
                text-align: center;
              }
              .icon {
                font-size: 64px;
                margin-bottom: 20px;
                color: #3498db;
              }
              h1 {
                color: #2c3e50;
                margin-bottom: 20px;
              }
              p {
                color: #34495e;
                line-height: 1.5;
                margin-bottom: 20px;
              }
              .form {
                margin-top: 30px;
              }
              .textarea {
                width: 100%;
                height: 200px;
                padding: 12px;
                margin-bottom: 20px;
                border: 1px solid #ddd;
                border-radius: 4px;
                font-family: inherit;
                font-size: 14px;
                box-sizing: border-box;
              }
              .spinner {
                display: inline-block;
                width: 30px;
                height: 30px;
                border: 4px solid rgba(0, 0, 0, 0.1);
                border-radius: 50%;
                border-top-color: #3498db;
                animation: spin 1s ease-in-out infinite;
                margin-right: 10px;
                vertical-align: middle;
              }
              @keyframes spin {
                to { transform: rotate(360deg); }
              }
              .hidden {
                display: none;
              }
              .button {
                padding: 12px 24px;
                background-color: #4CAF50;
                color: white;
                border: none;
                border-radius: 4px;
                font-weight: 500;
                cursor: pointer;
                font-size: 16px;
              }
              .button:hover {
                background-color: #45a049;
              }
              .message {
                margin-top: 20px;
                padding: 12px;
                border-radius: 4px;
              }
              .success {
                background-color: #d4edda;
                color: #155724;
              }
              .error {
                background-color: #f8d7da;
                color: #721c24;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="icon">⚙️</div>
              <h1>Recupero messaggio in corso</h1>
              <p>Il server è stato riavviato e il messaggio originale è stato perso.</p>
              <p>Se non è la prima volta che apri questa pagina, potresti avere il messaggio salvato nel browser.</p>
              
              <div id="automatic-recovery">
                <p><span class="spinner"></span> Tentativo di recupero automatico...</p>
              </div>
              
              <div id="manual-entry" class="hidden">
                <p>Non è stato possibile recuperare automaticamente il messaggio. Per favore, inserisci manualmente il messaggio da approvare:</p>
                <div class="form">
                  <textarea id="messageText" class="textarea" placeholder="Inserisci qui il messaggio..."></textarea>
                  <button onclick="submitMessage()" class="button">Continua</button>
                </div>
              </div>
              
              <div id="status-message" class="message hidden"></div>
            </div>
            
            <script>
              const messageId = "${id}";
              const email = "${email || 'no-reply@extendi.it'}";
              const skipHubspot = "${skipHubspot}";
              const baseUrl = "${baseUrl}";
              
              // Funzione per salvare il messaggio nel localStorage
              function saveMessageToLocalStorage(id, message) {
                try {
                  localStorage.setItem('message_' + id, message);
                  console.log('Messaggio salvato nel localStorage');
                  return true;
                } catch (error) {
                  console.error('Errore nel salvataggio nel localStorage:', error);
                  return false;
                }
              }
              
              // Funzione per recuperare il messaggio dal localStorage
              function getMessageFromLocalStorage(id) {
                try {
                  return localStorage.getItem('message_' + id);
                } catch (error) {
                  console.error('Errore nel recupero dal localStorage:', error);
                  return null;
                }
              }
              
              // Funzione per mostrare messaggi di stato
              function showStatusMessage(message, isError = false) {
                const statusElement = document.getElementById('status-message');
                statusElement.textContent = message;
                statusElement.className = 'message ' + (isError ? 'error' : 'success');
                statusElement.classList.remove('hidden');
              }
              
              // Funzione per continuare il processo con un messaggio
              function continueWithMessage(message) {
                // Salva il messaggio nel localStorage per future visite
                saveMessageToLocalStorage(messageId, message);
                
                // Crea l'URL con il messaggio e reindirizza
                const encodedMessage = encodeURIComponent(message);
                const continueUrl = baseUrl + '/api/approve?email=' + encodeURIComponent(email) + 
                                   '&skipHubspot=' + skipHubspot + 
                                   '&modifiedMessage=' + encodedMessage;
                
                window.location.href = continueUrl;
              }
              
              // Funzione per inviare il messaggio inserito manualmente
              function submitMessage() {
                const textareaElement = document.getElementById('messageText');
                const message = textareaElement.value.trim();
                
                if (!message) {
                  showStatusMessage('Per favore, inserisci un messaggio valido', true);
                  return;
                }
                
                continueWithMessage(message);
              }
              
              // Funzione principale che si avvia al caricamento della pagina
              function init() {
                // Tenta di recuperare dal localStorage
                const savedMessage = getMessageFromLocalStorage(messageId);
                
                if (savedMessage) {
                  console.log('Messaggio recuperato dal localStorage');
                  setTimeout(() => {
                    continueWithMessage(savedMessage);
                  }, 1000); // Piccolo ritardo per mostrare l'animazione
                } else {
                  console.log('Nessun messaggio trovato nel localStorage');
                  document.getElementById('automatic-recovery').classList.add('hidden');
                  document.getElementById('manual-entry').classList.remove('hidden');
                }
              }
              
              // Avvia il processo di recupero
              window.onload = init;
            </script>
          </body>
        </html>
      `);
    }

    // Verifico che ci sia il messaggio
    if (!message) {
      console.error('Messaggio mancante');
      
      // Restituisco una pagina HTML di errore
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
              <p>Non è possibile approvare l'email perché manca il messaggio da inviare.</p>
              
              <div class="details">
                <p><strong>Informazioni di debug:</strong></p>
                <p>URL: ${req.url}</p>
                <p>Query: ${JSON.stringify(req.query)}</p>
                <p>Email: ${email || 'non fornita'}</p>
                <p>Messaggio fornito: No</p>
                <p>Possibile causa: L'URL potrebbe essere incompleto o il messaggio troppo lungo per essere incluso nell'URL.</p>
              </div>
              
              <p>Torna alla pagina principale e riprova. Se il problema persiste, contatta l'amministratore del sistema.</p>
              <a href="javascript:window.close()" class="button">Chiudi questa finestra</a>
            </div>
          </body>
        </html>
      `);
    }

    // Se l'email non è presente, utilizziamo un valore predefinito
    if (!email) {
      email = "no-reply@extendi.it";
      console.log('Email non fornita, utilizzo email predefinita:', email);
    }

    console.log('Approvazione ricevuta per:', email);
    console.log('Messaggio da inviare (lunghezza):', message.length);

    // Se skipHubspot è presente e non false, mostra la pagina di modifica
    // altrimenti procedi con il salvataggio su HubSpot
    if (skipHubspot !== 'false') {
      // Pagina di modifica del messaggio
      const baseUrl = getBaseUrl();
      res.setHeader('Content-Type', 'text/html');
      return res.status(200).send(`
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
              .form-group {
                margin-bottom: 25px;
              }
              label {
                display: block;
                font-weight: 500;
                margin-bottom: 8px;
                color: #455a64;
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
                box-sizing: border-box;
              }
              .split-view {
                display: flex;
                gap: 20px;
                margin-bottom: 25px;
              }
              .editor, .preview {
                flex: 1;
              }
              .preview-content {
                border: 1px solid #ddd;
                border-radius: 4px;
                padding: 12px;
                min-height: 300px;
                background-color: #f9f9f9;
                overflow-y: auto;
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
                font-size: 16px;
              }
              .button-secondary {
                background-color: #607D8B;
              }
              .button-secondary:hover {
                background-color: #546E7A;
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
              
              <div class="split-view">
                <div class="editor">
                  <div class="form-group">
                    <label for="messageText">Testo del messaggio:</label>
                    <textarea id="messageText">${message}</textarea>
                  </div>
                </div>
                <div class="preview">
                  <label>Anteprima:</label>
                  <div class="preview-content" id="preview"></div>
                </div>
              </div>
              
              <div class="button-group">
                <button onclick="saveToHubspot()" class="button">Salva su HubSpot</button>
                <button onclick="window.close()" class="button button-secondary">Annulla</button>
              </div>
            </div>
            
            <!-- Includo la libreria Marked.js per il rendering del Markdown -->
            <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
            <script>
              // Configura Marked.js per il rendering
              marked.setOptions({
                breaks: true,
                gfm: true
              });
              
              // Aggiorna l'anteprima quando il testo cambia
              const textarea = document.getElementById('messageText');
              const preview = document.getElementById('preview');
              
              function updatePreview() {
                preview.innerHTML = marked.parse(textarea.value);
              }
              
              // Aggiorna inizialmente l'anteprima
              updatePreview();
              
              // Aggiungi l'evento di input per aggiornare l'anteprima in tempo reale
              textarea.addEventListener('input', updatePreview);
              
              // Funzione per salvare su HubSpot
              function saveToHubspot() {
                const modifiedText = textarea.value;
                const encodedText = encodeURIComponent(modifiedText);
                
                // Crea l'URL con il messaggio modificato e skipHubspot=false
                const url = '${baseUrl}/api/approve?email=${encodeURIComponent(email)}&modifiedMessage=' + encodedText + '&skipHubspot=false';
                
                // Reindirizza alla pagina di approvazione con il messaggio modificato
                window.location.href = url;
              }
            </script>
          </body>
        </html>
      `);
    }

    // Se siamo qui, dobbiamo salvare su HubSpot
    await sendHubSpotEmail(email, message);
    
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
          <!-- Includo la libreria Marked.js per il rendering del Markdown -->
          <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
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
            .message-content {
              background-color: #f9f9f9;
              padding: 25px;
              border-radius: 8px;
              margin: 20px 0;
              text-align: left;
              overflow-wrap: break-word;
              box-shadow: inset 0 0 5px rgba(0, 0, 0, 0.05);
              line-height: 1.6;
            }
            .message-content h1, 
            .message-content h2, 
            .message-content h3 {
              margin-top: 1.5em;
              margin-bottom: 0.8em;
              color: #2c3e50;
            }
            .message-content p {
              margin-bottom: 1.2em;
            }
            .message-content ul, 
            .message-content ol {
              padding-left: 1.5em;
              margin-bottom: 1.2em;
            }
            .message-content blockquote {
              border-left: 3px solid #ddd;
              margin-left: 0;
              padding-left: 1em;
              color: #666;
            }
            .message-content code {
              background-color: #f0f0f0;
              padding: 2px 4px;
              border-radius: 3px;
              font-family: monospace;
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
            .button-secondary {
              background-color: #607D8B;
              margin-left: 10px;
            }
            .button-secondary:hover {
              background-color: #546E7A;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success-icon">✅</div>
            <h1>Email Approvata con Successo</h1>
            <p>La risposta è stata registrata in HubSpot e presto verrà inviata al lead.</p>
            
            <div class="email-info">
              <p><strong>Email destinatario:</strong> ${email}</p>
            </div>
            
            <h2>Testo del Messaggio Approvato</h2>
            <div class="message-content" id="markdown-content">
              <!-- Il contenuto verrà inserito tramite JavaScript -->
            </div>
            
            <button onclick="window.close()" class="button">Chiudi questa finestra</button>
            <a href="javascript:history.back()" class="button button-secondary">Torna indietro</a>
          </div>
          
          <script>
            // Configura Marked.js per il rendering
            marked.setOptions({
              breaks: true,
              gfm: true
            });
            
            // Prendi il messaggio grezzo e renderizzalo come Markdown
            const rawMessage = ${JSON.stringify(message)};
            document.getElementById('markdown-content').innerHTML = marked.parse(rawMessage);
          </script>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Errore nella gestione approvazione:', error);
    res.status(500).json({ error: 'Errore interno del server' });
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

// Funzione comune per l'approvazione
function approveWithParams(email, message) {
  if (!email) {
    email = "no-reply@extendi.it"; // Usiamo un'email predefinita se non fornita
  }
  
  // Utilizziamo la stessa origine per l'URL di approvazione
  const baseUrl = window.location.origin;
  console.log('Base URL:', baseUrl);
  
  const approveUrl = baseUrl + '/api/approve?email=' + encodeURIComponent(email) + '&message=' + encodeURIComponent(message);
  console.log('Approve URL:', approveUrl);
  
  window.location.href = approveUrl;
} 