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
    const { token } = req.query;
    
    if (!token) {
      return res.status(400).json({ error: 'Token richiesto' });
    }

    // Controlla se il token è valido
    if (!pendingMessages.has(token)) {
      return res.status(404).json({ error: 'Token non valido o scaduto' });
    }

    // Se il token è già stato approvato
    if (approvedTokens.has(token)) {
      res.setHeader('Content-Type', 'text/html');
      return res.status(200).send(`
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
              <p>Questa email è già stata approvata e registrata. Non è possibile modificarla.</p>
              <a href="javascript:window.close()" class="button">Chiudi questa finestra</a>
            </div>
          </body>
        </html>
      `);
    }

    // Ottieni i dati del messaggio in sospeso
    const pendingData = pendingMessages.get(token);
    
    // Mostra il form di modifica
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
            button.save {
              background-color: #f39c12;
            }
            button.save:hover {
              background-color: #d35400;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Modifica Email</h1>
            <form id="edit-form">
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
                <button type="button" class="save" onclick="saveChanges()">Salva Modifiche</button>
                <button type="button" onclick="approveEmail()">Approva e Registra</button>
              </div>
            </form>
          </div>

          <script>
            // Funzione per salvare le modifiche al messaggio
            function saveChanges() {
              const message = document.getElementById('message').value;
              
              // Aggiorna il messaggio in pendenza
              fetch('/api/hubspot-form-submission?token=${token}', {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  message: message
                })
              })
              .then(response => {
                if (response.ok) {
                  alert('Modifiche salvate con successo');
                } else {
                  alert('Si è verificato un errore durante il salvataggio. Riprova più tardi.');
                }
              })
              .catch(error => {
                alert('Si è verificato un errore: ' + error.message);
              });
            }

            // Funzione per approvare direttamente l'email
            function approveEmail() {
              const message = document.getElementById('message').value;
              
              fetch('/api/approve?token=${token}', {
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
                  window.location.href = '/api/approve?token=${token}';
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
    console.error('Errore durante la modifica:', error);
    res.status(500).json({ error: 'Errore durante la modifica dell\'email' });
  }
} 