// Endpoint per modificare il messaggio
export default async function handler(req, res) {
  // Log della richiesta per debug
  console.log('Richiesta ricevuta su /api/edit');
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
    const { email, originalMessage } = req.query;
    
    console.log('Parametri ricevuti:');
    console.log('- email:', typeof email, email ? 'presente' : 'mancante');
    console.log('- originalMessage:', typeof originalMessage, originalMessage ? 'presente' : 'mancante');
    
    // Verifico che i parametri siano presenti
    if (!email || !originalMessage) {
      console.error('Parametri mancanti:', { email, originalMessage });
      
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
              <p>Non è possibile caricare il form di modifica perché mancano alcuni parametri necessari.</p>
              
              <div class="details">
                <p><strong>Parametri mancanti:</strong></p>
                ${!email ? '<p>• Email del destinatario</p>' : ''}
                ${!originalMessage ? '<p>• Messaggio originale</p>' : ''}
                
                <p><strong>Informazioni di debug:</strong></p>
                <p>URL: ${req.url}</p>
                <p>Query: ${JSON.stringify(req.query)}</p>
              </div>
              
              <p>Prova a tornare indietro e cliccare nuovamente sul pulsante "Modifica" nel messaggio di Slack.</p>
              <a href="javascript:window.close()" class="button">Chiudi questa finestra</a>
            </div>
          </body>
        </html>
      `);
    }

    console.log('Parametri validi, genero il form HTML');

    // Mostra il form di modifica con messaggio decodificato
    let decodedMessage = originalMessage;
    
    // Decodifico il messaggio solo se necessario
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

    console.log('Messaggio decodificato correttamente, lunghezza:', decodedMessage.length);

    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Modifica Email</title>
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
            <h1>Modifica Email</h1>
            <form id="edit-form">
              <div class="field">
                <label for="email">Email Destinatario:</label>
                <input type="email" id="email" value="${email}" disabled>
              </div>
              <div class="field">
                <label for="subject">Oggetto:</label>
                <input type="text" id="subject" value="Grazie per averci contattato" disabled>
              </div>
              <div class="field">
                <label for="message">Messaggio:</label>
                <textarea id="message">${decodedMessage}</textarea>
              </div>
              <div class="buttons">
                <button type="button" onclick="window.close()">Annulla</button>
                <button type="button" class="approve" onclick="approveEmail()">Approva e Registra</button>
              </div>
            </form>
          </div>

          <script>
            // Funzione per approvare direttamente l'email
            function approveEmail() {
              const message = document.getElementById('message').value;
              const email = document.getElementById('email').value;
              
              // Utilizziamo la stessa origine per l'URL di approvazione
              const baseUrl = window.location.origin;
              console.log('Base URL:', baseUrl);
              
              const approveUrl = baseUrl + '/api/approve?email=' + encodeURIComponent(email) + '&message=' + encodeURIComponent(message);
              console.log('Approve URL:', approveUrl);
              
              window.location.href = approveUrl;
            }
            
            // Log per debug
            console.log('Form di modifica caricato');
          </script>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Errore durante la modifica:', error);
    
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
            <p>Non è stato possibile elaborare la richiesta a causa di un errore interno.</p>
            
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