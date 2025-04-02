const { google } = require('googleapis');

// Gestione del callback OAuth2
export default async function handler(req, res) {
  // Abilita CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  try {
    // Ottieni il codice di autorizzazione dalla query
    const { code } = req.query;
    
    if (!code) {
      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Errore di Autenticazione</title>
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
                max-width: 700px;
                width: 100%;
              }
              .error-icon {
                font-size: 64px;
                margin-bottom: 20px;
                color: #f44336;
              }
              h1 {
                color: #2c3e50;
                margin-bottom: 20px;
                font-weight: 600;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="error-icon">❌</div>
              <h1>Errore di Autenticazione</h1>
              <p>Manca il codice di autorizzazione nella richiesta.</p>
            </div>
          </body>
        </html>
      `);
    }

    // Configurazione del client OAuth2
    const oAuth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      'https://leadqualifier.vercel.app/api/auth/callback'
    );

    // Scambia il codice di autorizzazione per i token
    const { tokens } = await oAuth2Client.getToken(code);
    const { refresh_token, access_token } = tokens;

    // Mostra le informazioni dei token (solo per debug, rimuovere in produzione)
    console.log('Refresh Token:', refresh_token);
    console.log('Access Token:', access_token);

    // Risposta HTML
    return res.status(200).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Autenticazione Completata</title>
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
            .token-info {
              background-color: #f1f8e9;
              padding: 15px;
              border-radius: 8px;
              margin: 20px 0;
              text-align: left;
              overflow-wrap: break-word;
              border-left: 4px solid #8bc34a;
              font-family: monospace;
              font-size: 14px;
              max-height: 200px;
              overflow-y: auto;
            }
            .instructions {
              background-color: #e3f2fd;
              padding: 15px;
              border-radius: 8px;
              margin: 20px 0;
              text-align: left;
              border-left: 4px solid #2196f3;
            }
            .instructions ol {
              margin-top: 10px;
              margin-bottom: 10px;
              padding-left: 20px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success-icon">✅</div>
            <h1>Autenticazione Completata</h1>
            <p>L'autenticazione OAuth2 con Google è stata completata con successo.</p>
            
            <div class="token-info">
              <p><strong>Refresh Token:</strong> ${refresh_token || 'Non disponibile (potresti già averne uno salvato)'}</p>
            </div>
            
            <div class="instructions">
              <h3>Prossimi passi:</h3>
              <ol>
                <li>Copia il Refresh Token sopra (se disponibile)</li>
                <li>Vai alle impostazioni di Vercel del progetto</li>
                <li>Aggiorna la variabile d'ambiente GOOGLE_REFRESH_TOKEN con questo nuovo valore</li>
                <li>Esegui un nuovo deploy dell'applicazione</li>
              </ol>
              <p><strong>Nota:</strong> Se non vedi un Refresh Token, potrebbe significare che ne è già stato emesso uno in precedenza. In questo caso, dovrai revocare l'accesso dell'app e riprovare.</p>
            </div>
          </div>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Errore nel callback OAuth:', error);
    
    return res.status(500).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Errore di Autenticazione</title>
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
              max-width: 700px;
              width: 100%;
            }
            .error-icon {
              font-size: 64px;
              margin-bottom: 20px;
              color: #f44336;
            }
            h1 {
              color: #2c3e50;
              margin-bottom: 20px;
              font-weight: 600;
            }
            .error-details {
              background-color: #ffebee;
              padding: 15px;
              border-radius: 8px;
              margin: 20px 0;
              text-align: left;
              overflow-wrap: break-word;
              border-left: 4px solid #f44336;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="error-icon">❌</div>
            <h1>Errore di Autenticazione</h1>
            <p>Si è verificato un errore durante l'elaborazione del callback OAuth.</p>
            
            <div class="error-details">
              <p><strong>Dettaglio errore:</strong> ${error.message}</p>
            </div>
          </div>
        </body>
      </html>
    `);
  }
} 