const { OpenAI } = require('openai');
import { sendGmailEmail } from './send-email';

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
  console.log('Query parameters:', req.query);
  console.log('Method:', req.method);
  console.log('Body:', req.body);

  // Abilita CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Gestisci preflight CORS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Estrai i parametri dalla richiesta (supporta sia GET che POST)
    let params;
    if (req.method === 'POST') {
      params = req.body || {};
      console.log('POST body ricevuto:', JSON.stringify(req.body));
    } else {
      params = req.query || {};
      console.log('GET params ricevuti:', JSON.stringify(req.query));
    }
    
    // Ottieni i parametri dalla richiesta
    const { email, id, modifiedMessage, skipHubspot, formDetails, message } = params;
    
    console.log('Parametri ricevuti:');
    console.log('- email:', typeof email, email ? 'presente' : 'mancante');
    console.log('- id:', typeof id, id ? 'presente' : 'mancante');
    console.log('- modifiedMessage:', typeof modifiedMessage, modifiedMessage ? 'presente (lunghezza: ' + modifiedMessage.length + ')' : 'mancante');
    console.log('- message:', typeof message, message ? 'presente (lunghezza: ' + message.length + ')' : 'mancante');
    console.log('- skipHubspot:', skipHubspot);
    console.log('- formDetails:', typeof formDetails, formDetails ? 'presente' : 'mancante');
    
    // Recupera il messaggio da uno dei parametri disponibili
    let messageToUse = modifiedMessage || message;
    
    // Se non abbiamo ancora un messaggio valido e c'è un ID, prova a recuperare dalla variabile globale
    if (!messageToUse && id) {
      messageToUse = global[`message_${id}`];
      console.log('Recupero messaggio da ID:', id);
      console.log('Messaggio trovato nella variabile globale:', messageToUse ? 'Sì (lunghezza: ' + messageToUse.length + ')' : 'No');
    }

    // Ottieni l'URL base corrente per i link
    const baseUrl = getBaseUrl();

    // Se non abbiamo un messaggio ma abbiamo un ID, mostriamo una pagina di recupero che utilizzerà localStorage
    if (!messageToUse && id) {
      console.log('Messaggio non trovato in memoria, tentativo di recupero da localStorage');
      
      // Pagina di recupero dati da localStorage
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
              <div class="spinner"></div>
              <h1>Recupero Messaggio</h1>
              <p>Stiamo recuperando il messaggio dal localStorage...</p>
              <div id="status"></div>
              <div id="debug" style="margin-top: 20px; font-size: 12px; color: #777; text-align: left; display: none;"></div>
              <button id="debugBtn" style="margin-top: 20px; padding: 5px 10px; font-size: 12px; background: #eee; border: 1px solid #ccc; cursor: pointer;">Mostra Debug</button>
            </div>
            
            <script>
              // Elementi UI
              const statusEl = document.getElementById('status');
              const debugEl = document.getElementById('debug');
              const debugBtn = document.getElementById('debugBtn');
              const spinner = document.querySelector('.spinner');
              
              // Parametri della pagina
              const messageId = "${id}";
              const email = "${email || 'no-reply@extendi.it'}";
              const skipHubspot = ${skipHubspot === 'true'};
              const baseUrl = "${baseUrl}";
              
              // Informazioni di debug
              let debugInfo = [];
              
              // Funzione per aggiungere info di debug
              function logDebug(msg) {
                console.log(msg);
                debugInfo.push(msg);
                debugEl.innerHTML = debugInfo.map(item => '<div>' + item + '</div>').join('');
              }
              
              // Funzione per aggiornare lo stato
              function updateStatus(msg, isError = false) {
                statusEl.innerHTML = msg;
                statusEl.style.padding = '10px';
                statusEl.style.marginTop = '20px';
                statusEl.style.borderRadius = '4px';
                
                if (isError) {
                  statusEl.style.backgroundColor = '#ffebee';
                  statusEl.style.color = '#d32f2f';
                  statusEl.style.border = '1px solid #ffcdd2';
                  spinner.style.display = 'none';
                } else {
                  statusEl.style.backgroundColor = '#e8f5e9';
                  statusEl.style.color = '#388e3c';
                  statusEl.style.border = '1px solid #c8e6c9';
                }
              }
              
              // Mostra/nascondi debug
              debugBtn.addEventListener('click', function() {
                if (debugEl.style.display === 'none') {
                  debugEl.style.display = 'block';
                  this.textContent = 'Nascondi Debug';
                } else {
                  debugEl.style.display = 'none';
                  this.textContent = 'Mostra Debug';
                }
              });
              
              // Funzione principale
              async function init() {
                try {
                  // Logga tutte le chiavi in localStorage per debug
                  const allKeys = Object.keys(localStorage);
                  logDebug('Tutte le chiavi in localStorage: ' + allKeys.join(', '));
                  
                  // Recupero messaggio
                  const messageKey = 'message_' + messageId;
                  const savedMessage = localStorage.getItem(messageKey);
                  
                  logDebug('Chiave messaggio: ' + messageKey);
                  logDebug('Messaggio trovato: ' + (savedMessage ? 'Sì' : 'No'));
                  
                  if (!savedMessage) {
                    updateStatus('Non è stato possibile recuperare il messaggio. Torna a Slack e riprova.', true);
                    return;
                  }
                  
                  // Recupero email di backup
                  const savedEmail = localStorage.getItem('email_' + messageId) || email;
                  logDebug('Email: ' + savedEmail);
                  
                  // Recupero eventuali dettagli del form
                  const formDetailsKey = 'formDetails_' + messageId;
                  const formDetailsStr = localStorage.getItem(formDetailsKey);
                  logDebug('Dettagli form trovati: ' + (formDetailsStr ? 'Sì' : 'No'));
                  
                  // Costruisci l'URL con il messaggio recuperato
                  const params = new URLSearchParams({
                    email: savedEmail,
                    id: messageId,
                    skipHubspot: skipHubspot
                  });
                  
                  if (savedMessage) {
                    params.append('message', savedMessage);
                  }
                  
                  if (formDetailsStr) {
                    params.append('formDetails', formDetailsStr);
                  }
                  
                  const newUrl = '${baseUrl}/api/approve?' + params.toString();
                  logDebug('Reindirizzamento a: ' + newUrl);
                  
                  // Aggiorna lo stato
                  updateStatus('Messaggio recuperato, reindirizzamento in corso...');
                  
                  // Reindirizza
                  setTimeout(() => {
                    window.location.href = newUrl;
                  }, 1000);
                } catch (error) {
                  console.error('Errore nel recupero:', error);
                  logDebug('Errore: ' + error.message);
                  updateStatus('Si è verificato un errore: ' + error.message, true);
                }
              }
              
              // Avvia l'inizializzazione
              init();
            </script>
          </body>
        </html>
      `);
    }

    // Verifica che l'email sia presente e valida
    if (!email || !email.includes('@')) {
      console.error('Email mancante o non valida:', email);
      return res.status(400).json({ error: 'Email mancante o non valida' });
    }

    console.log('Approvazione ricevuta per:', email);
    console.log('Messaggio da inviare (lunghezza):', messageToUse.length);

    // Se skipHubspot è presente e non false, mostra la pagina di modifica
    // altrimenti procedi con il salvataggio su HubSpot
    if (skipHubspot !== 'false' && skipHubspot !== false) {
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
                    <textarea id="messageText">${messageToUse}</textarea>
                  </div>
                </div>
                <div class="preview">
                  <label>Anteprima:</label>
                  <div class="preview-content" id="preview"></div>
                </div>
              </div>
              
              <div class="button-group">
                <button onclick="saveToHubspot()" class="button">Salva su HubSpot e invia email</button>
                <button onclick="window.close()" class="button button-secondary">Annulla</button>
              </div>
            </div>
            
            <!-- Includo la libreria Marked.js per il rendering del Markdown -->
            <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
            <script>
              // Variabili globali necessarie
              const baseUrl = "${baseUrl}";
              const email = "${email}";
              let formDetailsFromQuery = null;
              
              // Recupera i dettagli del form da localStorage
              try {
                const formDetailsKey = 'formDetails_' + "${id}";
                const formDetailsStr = localStorage.getItem(formDetailsKey);
                if (formDetailsStr) {
                  formDetailsFromQuery = formDetailsStr;
                  console.log('Dettagli form recuperati da localStorage');
                } else {
                  // Fallback per i dettagli del form dalla query
                  ${formDetails ? `formDetailsFromQuery = ${JSON.stringify(formDetails)};` : ''}
                  console.log('Dettagli form dalla query');
                }
              } catch (e) {
                console.error('Errore nel recupero dei dettagli del form:', e);
              }
              
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
                // Mostra un messaggio di elaborazione
                const loadingMessage = document.createElement('div');
                loadingMessage.style.position = 'fixed';
                loadingMessage.style.top = '0';
                loadingMessage.style.left = '0';
                loadingMessage.style.width = '100%';
                loadingMessage.style.padding = '10px';
                loadingMessage.style.backgroundColor = '#4CAF50';
                loadingMessage.style.color = 'white';
                loadingMessage.style.textAlign = 'center';
                loadingMessage.style.zIndex = '1000';
                loadingMessage.textContent = 'Elaborazione in corso...';
                document.body.appendChild(loadingMessage);
                
                // Ottieni il testo modificato
                const modifiedText = textarea.value;
                
                // Salva il messaggio nel localStorage come backup
                try {
                  localStorage.setItem('message_backup', modifiedText);
                } catch (e) {
                  console.error('Errore nel salvare il messaggio di backup:', e);
                }
                
                // Prepara i formDetails per l'invio
                let formDetailsParam = null;
                if (formDetailsFromQuery) {
                  console.log('FormDetails da includere nella richiesta POST:', formDetailsFromQuery);
                  // Se è già una stringa JSON valida, usala direttamente
                  formDetailsParam = formDetailsFromQuery;
                }
                
                // Utilizza il metodo FETCH POST per inviare i dati al server
                fetch(baseUrl + '/api/approve', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    email: email,
                    modifiedMessage: modifiedText,
                    skipHubspot: false,
                    formDetails: formDetailsParam
                  })
                })
                .then(response => {
                  if (!response.ok) {
                    throw new Error('Errore nella richiesta: ' + response.status);
                  }
                  return response.text();
                })
                .then(html => {
                  // Sostituisci l'intero contenuto della pagina con la risposta HTML
                  document.open();
                  document.write(html);
                  document.close();
                })
                .catch(error => {
                  console.error('Errore durante il salvataggio:', error);
                  loadingMessage.style.backgroundColor = '#f44336';
                  loadingMessage.textContent = 'Errore: ' + error.message;
                });
              }
            </script>
          </body>
        </html>
      `);
    }

    // Se siamo qui, dobbiamo salvare su HubSpot
    console.log('Salvataggio su Hubspot in corso...');
    console.log('formDetails tipo:', typeof formDetails);
    console.log('formDetails valore:', formDetails);
    
    await sendHubSpotEmail(email, messageToUse, formDetails);
    
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
            const rawMessage = ${JSON.stringify(messageToUse)};
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