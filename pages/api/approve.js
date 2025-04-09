import { getMessage, updateMessage } from '../../utils/supabase';
import { sendHubSpotEmail } from '../../utils/hubspot';
import { sendApprovalConfirmationToSlack } from '../../utils/slack';

export default async function handler(req, res) {
  // Log della richiesta
  console.log('Richiesta ricevuta:', {
    method: req.method,
    query: req.query,
    body: req.body
  });

  try {
    const { id, email, skipHubspot, modifiedMessage } = req.query;

    // Verifica che l'ID sia presente
    if (!id) {
      console.error('ID messaggio mancante');
      return res.status(400).send('ID messaggio mancante');
    }

    // Recupera il messaggio da Supabase
    const messageData = await getMessage(id);
    if (!messageData) {
      console.error('Messaggio non trovato in Supabase');
      return res.status(400).send('Messaggio non trovato');
    }

    // Determina quale messaggio usare
    let messageToUse = modifiedMessage || messageData.message_text;

    // Se skipHubspot è true, mostra solo la pagina di modifica
    if (skipHubspot === 'true') {
      return res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Modifica Messaggio</title>
            <style>
              body {
                font-family: Arial, sans-serif;
                max-width: 800px;
                margin: 0 auto;
                padding: 20px;
                background-color: #f5f5f5;
              }
              .container {
                background: white;
                padding: 20px;
                border-radius: 8px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              }
              textarea {
                width: 100%;
                height: 200px;
                margin: 10px 0;
                padding: 10px;
                border: 1px solid #ddd;
                border-radius: 4px;
              }
              button {
                background: #007bff;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 4px;
                cursor: pointer;
              }
              button:hover {
                background: #0056b3;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>Modifica Messaggio</h1>
              <textarea id="messageText">${messageToUse}</textarea>
              <button onclick="saveToHubspot()">Salva su HubSpot e invia email</button>
            </div>
            <script>
              const baseUrl = window.location.origin;
              const email = "${email}";
              
              function saveToHubspot() {
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
                
                const modifiedText = document.getElementById('messageText').value;
                
                fetch(baseUrl + '/api/approve', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    id: "${id}",
                    email: email,
                    modifiedMessage: modifiedText,
                    skipHubspot: false
                  })
                })
                .then(response => {
                  if (!response.ok) {
                    throw new Error('Errore nella richiesta: ' + response.status);
                  }
                  return response.text();
                })
                .then(html => {
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
    
    // Prepara i formDetails per l'invio
    let formDetailsToSend = messageData.form_details;
    if (typeof formDetailsToSend === 'string') {
      try {
        formDetailsToSend = JSON.parse(formDetailsToSend);
      } catch (error) {
        console.error('Errore nel parsing dei formDetails:', error);
        formDetailsToSend = {};
      }
    }
    
    console.log('FormDetails preparati per HubSpot:', formDetailsToSend);
    
    await sendHubSpotEmail(email, messageToUse, formDetailsToSend);
    
    // Invia messaggio di conferma a Slack
    await sendApprovalConfirmationToSlack(email);
    
    // Aggiorna lo stato del messaggio in Supabase
    try {
      await updateMessage(id, {
        status: 'approved',
        approved_at: new Date().toISOString()
      });
    } catch (error) {
      console.error('Errore nell\'aggiornamento dello stato del messaggio:', error);
    }

    // Mostra la pagina di conferma
    return res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Messaggio Inviato</title>
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
              background: white;
              padding: 20px;
              border-radius: 8px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              text-align: center;
            }
            .success {
              color: #28a745;
              font-size: 24px;
              margin-bottom: 20px;
            }
            a {
              color: #007bff;
              text-decoration: none;
            }
            a:hover {
              text-decoration: underline;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success">✓</div>
            <h1>Messaggio inviato con successo!</h1>
            <p>Il messaggio è stato inviato a ${email} e salvato su HubSpot.</p>
            <p><a href="/messages">Torna alla lista dei messaggi</a></p>
          </div>
        </body>
      </html>
    `);

  } catch (error) {
    console.error('Errore durante l\'elaborazione:', error);
    return res.status(500).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Errore</title>
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
              background: white;
              padding: 20px;
              border-radius: 8px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              text-align: center;
            }
            .error {
              color: #dc3545;
              font-size: 24px;
              margin-bottom: 20px;
            }
            a {
              color: #007bff;
              text-decoration: none;
            }
            a:hover {
              text-decoration: underline;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="error">✕</div>
            <h1>Si è verificato un errore</h1>
            <p>${error.message}</p>
            <p><a href="/messages">Torna alla lista dei messaggi</a></p>
          </div>
        </body>
      </html>
    `);
  }
} 