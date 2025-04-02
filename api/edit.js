// Endpoint per modificare il messaggio
export default async function handler(req, res) {
  // Log della richiesta per debug
  console.log('Richiesta ricevuta su /api/edit');
  console.log('URL completo:', req.url);
  console.log('Query completa:', JSON.stringify(req.query));
  console.log('Query params individuali:');
  for (const [key, value] of Object.entries(req.query)) {
    console.log(`- ${key}: ${value}`);
  }
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  
  // Abilita CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Gestisci preflight CORS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Estraggo la email direttamente dall'URL completo per verificare se è presente
  const urlSearchParams = new URLSearchParams(req.url.split('?')[1] || '');
  const emailFromUrl = urlSearchParams.get('email');
  console.log('Email estratta direttamente dall\'URL:', emailFromUrl);

  try {
    // Estraggo i parametri dalla query
    let { email, originalMessage } = req.query;
    
    console.log('Parametri ricevuti (dopo estrazione):');
    console.log('- email:', typeof email, email ? 'presente' : 'mancante');
    console.log('- originalMessage:', typeof originalMessage, originalMessage ? 'presente' : 'mancante');
    
    // Verifico che ci sia almeno il messaggio originale
    if (!originalMessage) {
      console.error('Messaggio originale mancante');
      
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
              <p>Non è possibile caricare il form di modifica perché manca il messaggio originale.</p>
              
              <div class="details">
                <p><strong>Informazioni di debug:</strong></p>
                <p>URL completo: ${req.url}</p>
                <p>Query params: ${JSON.stringify(req.query)}</p>
                <p>Email estratta direttamente: ${emailFromUrl || 'non trovata'}</p>
              </div>
              
              <p>Prova a tornare indietro e cliccare nuovamente sul pulsante "Modifica" nel messaggio di Slack.</p>
              <a href="javascript:window.close()" class="button">Chiudi questa finestra</a>
            </div>
          </body>
        </html>
      `);
    }

    // Controlla se l'email è stata trovata da qualsiasi fonte
    if (!email && emailFromUrl) {
      email = emailFromUrl;
      console.log('Email recuperata dall\'URL completo:', email);
    }

    // Usiamo un'email predefinita se non fornita
    if (!email) {
      // Per debug, mostro una pagina speciale se l'email manca
      res.setHeader('Content-Type', 'text/html');
      return res.status(200).send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Debug Email Mancante</title>
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
                padding: 30px;
                border-radius: 8px;
                box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
                max-width: 900px;
                margin: 0 auto;
              }
              h1 {
                color: #e74c3c;
                margin-bottom: 20px;
              }
              h2 {
                color: #3498db;
                margin-top: 30px;
                margin-bottom: 10px;
              }
              p {
                color: #333;
                margin-bottom: 15px;
                line-height: 1.5;
              }
              .box {
                background-color: #f9f9f9;
                padding: 15px;
                border-radius: 4px;
                margin: 20px 0;
                text-align: left;
                font-family: monospace;
                white-space: pre-wrap;
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
              .action-buttons {
                display: flex;
                gap: 10px;
                justify-content: center;
                margin-top: 30px;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>Debug - Parametro Email Mancante</h1>
              <p>È stato rilevato che il parametro 'email' non è presente nella query dell'URL.</p>
              
              <h2>Dettagli della richiesta</h2>
              <div class="box">URL completo: ${req.url}</div>
              <div class="box">Query params come JSON: ${JSON.stringify(req.query, null, 2)}</div>
              <div class="box">Email estratta direttamente: ${emailFromUrl || 'non trovata'}</div>
              
              <h2>Analisi e possibili cause</h2>
              <p>I motivi per cui l'email potrebbe mancare includono:</p>
              <ul>
                <li>Slack modifica o filtra alcuni parametri negli URL</li>
                <li>Il parametro email è stato codificato in modo errato</li>
                <li>L'URL è stato troncato a causa della lunghezza eccessiva</li>
                <li>Un problema con la configurazione di Vercel impedisce il passaggio corretto dei parametri</li>
              </ul>
              
              <h2>Soluzioni</h2>
              <p>Puoi procedere in uno dei seguenti modi:</p>
              
              <div class="action-buttons">
                <a href="javascript:useDefaultEmail()" class="button">Usa Email Predefinita</a>
                <a href="javascript:specifyEmail()" class="button">Specifica Email</a>
                <a href="javascript:window.close()" class="button">Chiudi pagina</a>
              </div>
            </div>
            
            <script>
              function useDefaultEmail() {
                const defaultEmail = "no-reply@extendi.it";
                const currentUrl = new URL(window.location.href);
                currentUrl.searchParams.set('email', defaultEmail);
                window.location.href = currentUrl.toString();
              }
              
              function specifyEmail() {
                const email = prompt("Inserisci l'email del destinatario:", "");
                if (email) {
                  const currentUrl = new URL(window.location.href);
                  currentUrl.searchParams.set('email', email);
                  window.location.href = currentUrl.toString();
                }
              }
            </script>
          </body>
        </html>
      `);
      
      // email = "no-reply@extendi.it";
      // console.log('Email non fornita, utilizzo email predefinita:', email);
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
          <!-- Includo la libreria Marked.js per il rendering del Markdown -->
          <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
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
              max-width: 900px;
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
              line-height: 1.5;
            }
            textarea {
              min-height: 250px;
              resize: vertical;
              white-space: pre-wrap;
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
            .preview-container {
              margin-top: 20px;
              border: 1px solid #ddd;
              border-radius: 4px;
              padding: 15px;
              background-color: #f9f9f9;
            }
            .preview-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 10px;
            }
            .preview-toggle {
              background-color: transparent;
              color: #3498db;
              border: 1px solid #3498db;
              padding: 5px 10px;
              border-radius: 4px;
              cursor: pointer;
              font-size: 14px;
            }
            .preview-content {
              padding: 10px;
              background-color: white;
              border-radius: 4px;
              line-height: 1.6;
              overflow-wrap: break-word;
            }
            .preview-content p {
              margin-top: 0;
              margin-bottom: 16px;
            }
            .preview-content ul, .preview-content ol {
              margin-bottom: 16px;
              padding-left: 30px;
            }
            .preview-content li {
              margin-bottom: 8px;
            }
            .preview-content h1, .preview-content h2, .preview-content h3 {
              margin-top: 24px;
              margin-bottom: 16px;
              color: #333;
            }
            .preview-content code {
              background-color: #f1f1f1;
              padding: 2px 4px;
              border-radius: 3px;
              font-family: monospace;
            }
            .flex-container {
              display: flex;
              gap: 20px;
            }
            .editor-container, .preview-container {
              flex: 1;
            }
            .split-view {
              display: none;
            }
            .split-view.active {
              display: flex;
            }
            .view-toggle {
              margin-top: 10px;
              display: flex;
              gap: 10px;
              justify-content: center;
            }
            .view-toggle button {
              background-color: #f1f1f1;
              color: #333;
              border: 1px solid #ddd;
              padding: 5px 15px;
              font-size: 14px;
            }
            .view-toggle button.active {
              background-color: #3498db;
              color: white;
              border-color: #3498db;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Modifica Email</h1>
            
            <div class="view-toggle">
              <button id="btn-editor" class="active" onclick="switchView('editor')">Solo Editor</button>
              <button id="btn-split" onclick="switchView('split')">Editor + Anteprima</button>
              <button id="btn-preview" onclick="switchView('preview')">Solo Anteprima</button>
            </div>
            
            <div id="editor-view" class="split-view active">
              <form id="edit-form">
                <div class="field" style="display: none;">
                  <label for="email">Email Destinatario:</label>
                  <input type="email" id="email" value="${email}" readonly>
                </div>
                <div class="field">
                  <label for="subject">Oggetto:</label>
                  <input type="text" id="subject" value="Grazie per averci contattato" disabled>
                </div>
                <div class="field">
                  <label for="message">Messaggio:</label>
                  <textarea id="message" oninput="updatePreview()">${decodedMessage}</textarea>
                </div>
                <div class="buttons">
                  <button type="button" onclick="window.close()">Annulla</button>
                  <button type="button" class="approve" onclick="approveEmail()">Approva e Registra</button>
                </div>
              </form>
            </div>
            
            <div id="split-view" class="split-view">
              <div class="flex-container">
                <div class="editor-container">
                  <form id="split-form">
                    <div class="field" style="display: none;">
                      <label for="email-split">Email Destinatario:</label>
                      <input type="email" id="email-split" value="${email}" readonly>
                    </div>
                    <div class="field">
                      <label for="subject-split">Oggetto:</label>
                      <input type="text" id="subject-split" value="Grazie per averci contattato" disabled>
                    </div>
                    <div class="field">
                      <label for="message-split">Messaggio:</label>
                      <textarea id="message-split" oninput="updatePreview(this.value)">${decodedMessage}</textarea>
                    </div>
                    <div class="buttons">
                      <button type="button" onclick="window.close()">Annulla</button>
                      <button type="button" class="approve" onclick="approveEmailSplit()">Approva e Registra</button>
                    </div>
                  </form>
                </div>
                <div class="preview-container">
                  <div class="preview-header">
                    <h3>Anteprima</h3>
                    <button class="preview-toggle" onclick="refreshPreview()">Aggiorna</button>
                  </div>
                  <div id="preview-content" class="preview-content"></div>
                </div>
              </div>
            </div>
            
            <div id="preview-view" class="split-view">
              <div class="field" style="display: none;">
                <label for="email-preview">Email Destinatario:</label>
                <input type="email" id="email-preview" value="${email}" readonly>
              </div>
              <div class="field">
                <label for="subject-preview">Oggetto:</label>
                <input type="text" id="subject-preview" value="Grazie per averci contattato" disabled>
              </div>
              <div class="preview-container">
                <div class="preview-header">
                  <h3>Anteprima del Messaggio</h3>
                </div>
                <div id="preview-content-full" class="preview-content"></div>
              </div>
              <div class="buttons">
                <button type="button" onclick="window.close()">Annulla</button>
                <button type="button" onclick="switchView('editor')">Modifica</button>
                <button type="button" class="approve" onclick="approveEmailPreview()">Approva e Registra</button>
              </div>
            </div>
          </div>

          <script>
            // Funzioni per gestire la visualizzazione
            function switchView(view) {
              document.getElementById('editor-view').classList.remove('active');
              document.getElementById('split-view').classList.remove('active');
              document.getElementById('preview-view').classList.remove('active');
              
              document.getElementById('btn-editor').classList.remove('active');
              document.getElementById('btn-split').classList.remove('active');
              document.getElementById('btn-preview').classList.remove('active');
              
              document.getElementById(view + '-view').classList.add('active');
              document.getElementById('btn-' + view).classList.add('active');
              
              // Sincronizza i contenuti tra le viste
              syncContent(view);
              
              // Aggiorna l'anteprima quando si passa a una vista con anteprima
              if (view === 'split' || view === 'preview') {
                refreshPreview();
              }
            }
            
            // Sincronizza i contenuti tra le diverse viste
            function syncContent(currentView) {
              const message = document.getElementById('message').value;
              const email = document.getElementById('email').value;
              
              if (currentView !== 'editor') {
                document.getElementById('message-split').value = message;
                document.getElementById('email-split').value = email;
              }
              
              if (currentView !== 'split') {
                document.getElementById('message').value = document.getElementById('message-split').value;
                document.getElementById('email').value = document.getElementById('email-split').value;
              }
              
              document.getElementById('email-preview').value = email;
            }
            
            // Funzione per aggiornare l'anteprima
            function updatePreview(value) {
              // Sincronizza i contenuti tra le diverse viste
              const message = value || document.getElementById('message').value;
              document.getElementById('message').value = message;
              document.getElementById('message-split').value = message;
            }
            
            // Aggiorna la visualizzazione markdown
            function refreshPreview() {
              const message = document.getElementById('message').value;
              const htmlContent = marked.parse(message);
              document.getElementById('preview-content').innerHTML = htmlContent;
              document.getElementById('preview-content-full').innerHTML = htmlContent;
            }
            
            // Funzione per approvare direttamente l'email (vista editor)
            function approveEmail() {
              const message = document.getElementById('message').value;
              const email = document.getElementById('email').value;
              approveWithParams(email, message);
            }
            
            // Funzione per approvare l'email (vista split)
            function approveEmailSplit() {
              const message = document.getElementById('message-split').value;
              const email = document.getElementById('email-split').value;
              approveWithParams(email, message);
            }
            
            // Funzione per approvare l'email (vista anteprima)
            function approveEmailPreview() {
              const message = document.getElementById('message').value;
              const email = document.getElementById('email-preview').value;
              approveWithParams(email, message);
            }
            
            // Funzione comune per l'approvazione
            function approveWithParams(email, message) {
              if (!email) {
                alert('Per favore inserisci l\'email del destinatario');
                return;
              }
              
              // Utilizziamo la stessa origine per l'URL di approvazione
              const baseUrl = window.location.origin;
              console.log('Base URL:', baseUrl);
              
              const approveUrl = baseUrl + '/api/approve?email=' + encodeURIComponent(email) + '&message=' + encodeURIComponent(message);
              console.log('Approve URL:', approveUrl);
              
              window.location.href = approveUrl;
            }
            
            // Inizializza la pagina
            document.addEventListener('DOMContentLoaded', function() {
              // Configurazione marked.js per il parsing del markdown
              marked.setOptions({
                breaks: true,
                gfm: true
              });
              
              // Aggiorna l'anteprima all'avvio
              refreshPreview();
            });
            
            // Aggiorna subito l'anteprima
            refreshPreview();
            
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