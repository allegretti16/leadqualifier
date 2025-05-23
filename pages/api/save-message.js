import { supabase } from '../../utils/supabase'

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
    const { id, message, email, formDetails, originalMessage } = req.query;
    
    console.log('Query params ricevuti:', { 
      id, 
      email, 
      formDetailsLength: formDetails ? formDetails.length : 0,
      originalMessageLength: originalMessage ? originalMessage.length : 0
    });
    console.log('FormDetails (primi 100 caratteri):', formDetails ? formDetails.substring(0, 100) + '...' : 'non presente');
    console.log('Message length:', message ? message.length : 0);
    console.log('Original Message length:', originalMessage ? originalMessage.length : 0);
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

    // Salva il messaggio in Supabase
    try {
      await supabase.from('messages').insert([
        {
          id,
          email,
          message,
          formDetails,
          originalMessage
        }
      ]);
      console.log('Messaggio salvato con successo in Supabase');
    } catch (error) {
      console.error('Errore nel salvataggio del messaggio:', error);
      return res.status(500).json({ error: 'Errore nel salvataggio del messaggio' });
    }

    // Crea URL per l'approvazione
    const baseUrl = getBaseUrl();
    let approveUrl = `${baseUrl}/api/approve?id=${id}&email=${encodeURIComponent(email)}&skipHubspot=true`;
    
    // Aggiungi formDetails solo se presente
    if (formDetails) {
      approveUrl += `&formDetails=${encodeURIComponent(formDetails)}`;
    }

    // Restituisci una pagina HTML che reindirizza
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
            <h1>Salvataggio completato</h1>
            <p>Stai per essere reindirizzato alla pagina di approvazione...</p>
            <div id="error" class="error"></div>
          </div>
          
          <script>
            // Reindirizza alla pagina di approvazione
            setTimeout(function() {
              window.location.href = "${approveUrl}";
            }, 500);
          </script>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Errore nella gestione della richiesta:', error);
    return res.status(500).json({ error: error.message });
  }
} 