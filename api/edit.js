// Endpoint per modificare il messaggio
export default async function handler(req, res) {
  // Abilita CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  try {
    const { email, originalMessage } = req.query;
    
    if (!email || !originalMessage) {
      return res.status(400).json({ error: 'Email e messaggio originale richiesti' });
    }

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
                <textarea id="message">${originalMessage}</textarea>
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
              
              const baseUrl = window.location.origin;
              const approveUrl = baseUrl + '/api/approve?email=' + encodeURIComponent(email) + '&message=' + encodeURIComponent(message);
              
              window.location.href = approveUrl;
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