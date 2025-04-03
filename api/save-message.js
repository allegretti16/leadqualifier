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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Gestisci preflight CORS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Ottieni i parametri dalla query
    const { id, message, email, formDetails } = req.query;
    
    console.log('Query params ricevuti:', { id, email, formDetailsLength: formDetails ? formDetails.length : 0 });
    console.log('FormDetails (primi 100 caratteri):', formDetails ? formDetails.substring(0, 100) + '...' : 'non presente');
    console.log('Message length:', message ? message.length : 0);
    if (formDetails) {
      console.log('FormDetails length:', formDetails.length);
    }

    // Verifica che l'email sia presente e valida
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Email mancante o non valida' });
    }

    // Verifica che l'ID sia presente
    if (!id) {
      return res.status(400).json({ error: 'ID messaggio mancante' });
    }

    // Crea URL per l'approvazione
    const baseUrl = getBaseUrl();
    let approveUrl = `${baseUrl}/api/approve?id=${id}&email=${encodeURIComponent(email)}&skipHubspot=true`;
    
    // Aggiungi formDetails solo se presente
    if (formDetails) {
      approveUrl += `&formDetails=${encodeURIComponent(formDetails)}`;
    }

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
            .error {
              color: #e74c3c;
              margin-top: 20px;
              padding: 10px;
              background-color: #fdf0f0;
              border-radius: 4px;
              display: none;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="spinner"></div>
            <h1>Salvataggio in corso...</h1>
            <p>Stiamo preparando il messaggio per la modifica...</p>
            <div id="error" class="error"></div>
          </div>
          
          <script>
            // Salvataggio sicuro in localStorage con log
            function safeStore(key, value) {
              try {
                localStorage.setItem(key, value);
                console.log('Salvato con successo:', key);
                return true;
              } catch (e) {
                console.error('Errore nel salvataggio di ' + key + ':', e);
                return false;
              }
            }
            
            // Mostra errore
            function showError(message) {
              const errorDiv = document.getElementById('error');
              errorDiv.textContent = message;
              errorDiv.style.display = 'block';
              document.querySelector('.spinner').style.display = 'none';
            }
            
            try {
              // Inizializza le variabili
              const messageId = "${id}";
              const email = "${email}";
              const messageText = ${JSON.stringify(message || '')};
              const approveUrl = "${approveUrl}";
              
              // Debug
              console.log('====== SALVATAGGIO DATI ======');
              console.log('ID:', messageId);
              console.log('Email:', email);
              console.log('Messaggio (primi 50 caratteri):', messageText.substring(0, 50));
              console.log('URL approvazione:', approveUrl);
              
              // Salva il messaggio nel localStorage
              const saveResult = safeStore('message_' + messageId, messageText);
              if (!saveResult) {
                throw new Error('Impossibile salvare il messaggio nel localStorage');
              }
              
              // Salva anche l'email per sicurezza
              safeStore('email_' + messageId, email);
              
              // Gestione dei dettagli del form
              ${formDetails ? `
              try {
                // Salva i dettagli del form direttamente
                const formDetailsStr = ${JSON.stringify(formDetails)};
                console.log('Form details (primi 50 caratteri):', formDetailsStr.substring(0, 50));
                safeStore('formDetails_' + messageId, formDetailsStr);
              } catch (formError) {
                console.error('Errore nel salvataggio dei dettagli del form:', formError);
              }
              ` : ''}
              
              // Test di verifica salvataggio
              const testSaved = localStorage.getItem('message_' + messageId);
              console.log('Verifica salvataggio:', testSaved ? 'OK (primi 50 caratteri): ' + testSaved.substring(0, 50) : 'FALLITO');
              
              // Reindirizza alla pagina di approvazione
              console.log('Reindirizzamento a:', approveUrl);
              setTimeout(function() {
                window.location.href = approveUrl;
              }, 500);
            } catch (error) {
              console.error('Errore nel processo di salvataggio:', error);
              showError('Si è verificato un errore durante il salvataggio del messaggio: ' + error.message);
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