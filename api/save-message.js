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
  // Abilita CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Gestisci preflight CORS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { id, message, email, skipHubspot } = req.query;

    if (!id || !message) {
      return res.status(400).json({ error: 'ID e messaggio sono richiesti' });
    }

    const baseUrl = getBaseUrl();
    const approveUrl = `${baseUrl}/api/approve?id=${id}&email=${encodeURIComponent(email || '')}&skipHubspot=${skipHubspot || 'true'}`;

    // Restituisci una pagina HTML che salva il messaggio in localStorage e poi reindirizza
    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Salvataggio Messaggio</title>
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
              max-width: 500px;
            }
            .spinner {
              display: inline-block;
              width: 40px;
              height: 40px;
              border: 4px solid #f3f3f3;
              border-top: 4px solid #3498db;
              border-radius: 50%;
              animation: spin 1s linear infinite;
              margin-bottom: 20px;
            }
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            h1 {
              color: #2c3e50;
              margin-bottom: 20px;
            }
            p {
              color: #34495e;
              line-height: 1.6;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="spinner"></div>
            <h1>Salvataggio in corso...</h1>
            <p>Stiamo salvando il messaggio nel tuo browser...</p>
          </div>
          
          <script>
            // Salva il messaggio in localStorage
            const messageId = "${id}";
            const message = ${JSON.stringify(message)};
            
            try {
              localStorage.setItem('message_' + messageId, message);
              console.log('Messaggio salvato con successo');
              
              // Reindirizza alla pagina di approvazione
              window.location.href = "${approveUrl}";
            } catch (error) {
              console.error('Errore nel salvataggio:', error);
              document.body.innerHTML = \`
                <div class="container">
                  <h1 style="color: #e74c3c;">Errore</h1>
                  <p>Si è verificato un errore durante il salvataggio del messaggio.</p>
                  <p>Dettaglio: \${error.message}</p>
                  <button onclick="window.location.reload()" style="padding: 10px 20px; margin-top: 20px;">Riprova</button>
                </div>
              \`;
            }
          </script>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Errore nella gestione della richiesta:', error);
    return res.status(500).json({ error: error.message });
  }
} 