export default async function handler(req, res) {
  // Gestione CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Ottiene parametri dall'URL
    const email = req.query.email;
    const message = req.query.message;

    // Log per debug
    console.log('Parametri ricevuti in edit-message.js:');
    console.log('- Email:', email);
    console.log('- Message:', message);

    // Verifica che entrambi i parametri siano presenti
    if (!email || !message) {
      console.error('Parametri mancanti:', { email: !!email, message: !!message });
      return res.status(400).setHeader('Content-Type', 'text/html').send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Errore - Parametri Mancanti</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 800px;
              margin: 0 auto;
              padding: 20px;
              text-align: center;
            }
            .error-container {
              background-color: #f8d7da;
              border: 1px solid #f5c6cb;
              border-radius: 5px;
              padding: 20px;
              margin-top: 30px;
            }
            h1 {
              color: #721c24;
            }
            .button {
              display: inline-block;
              background-color: #007bff;
              color: white;
              padding: 10px 20px;
              margin-top: 20px;
              border-radius: 5px;
              text-decoration: none;
            }
          </style>
        </head>
        <body>
          <div class="error-container">
            <h1>⚠️ Errore: Parametri Mancanti</h1>
            <p>Non sono stati forniti tutti i parametri necessari per la modifica del messaggio.</p>
            <p><strong>Email:</strong> ${email ? 'Presente' : 'Mancante'}</p>
            <p><strong>Messaggio:</strong> ${message ? 'Presente' : 'Mancante'}</p>
          </div>
          <a href="javascript:history.back()" class="button">Torna Indietro</a>
        </body>
        </html>
      `);
    }

    // Ottieni dominio di base per costruire gli URL
    let baseUrl;
    if (process.env.NODE_ENV === 'development') {
      baseUrl = 'http://localhost:3000';
    } else if (process.env.VERCEL_URL) {
      baseUrl = `https://${process.env.VERCEL_URL}`;
    } else {
      baseUrl = 'https://leadqualifier.vercel.app';
    }

    // Costruisci l'URL di approvazione che verrà utilizzato dopo la modifica
    const approveBaseUrl = `${baseUrl}/api/approve?email=${encodeURIComponent(email)}`;

    // Invia la pagina HTML con l'editor markdown
    res.setHeader('Content-Type', 'text/html').send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Modifica Messaggio</title>
        <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #f9f9f9;
          }
          .container {
            max-width: 900px;
            margin: 20px auto;
            padding: 20px;
            background-color: white;
            border-radius: 8px;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
          }
          h1 {
            text-align: center;
            color: #2c3e50;
            margin-bottom: 30px;
            border-bottom: 2px solid #eee;
            padding-bottom: 10px;
          }
          .form-group {
            margin-bottom: 25px;
          }
          label {
            display: block;
            margin-bottom: 8px;
            font-weight: bold;
          }
          .email-display {
            padding: 10px;
            background-color: #f8f9fa;
            border: 1px solid #ddd;
            border-radius: 4px;
            margin-bottom: 20px;
          }
          textarea {
            width: 100%;
            min-height: 250px;
            padding: 12px;
            border: 1px solid #ddd;
            border-radius: 4px;
            resize: vertical;
            font-family: monospace;
            font-size: 14px;
          }
          .preview {
            background-color: #f8f9fa;
            border: 1px solid #ddd;
            border-radius: 4px;
            padding: 15px;
            min-height: 150px;
            margin-top: 10px;
          }
          .preview-content {
            font-family: Arial, sans-serif;
          }
          .tabs {
            display: flex;
            margin-bottom: 10px;
          }
          .tab {
            padding: 8px 15px;
            border: 1px solid #ddd;
            border-bottom: none;
            border-radius: 4px 4px 0 0;
            cursor: pointer;
            margin-right: 5px;
            background-color: #f8f9fa;
          }
          .tab.active {
            background-color: white;
            font-weight: bold;
          }
          .editor-container, .preview-container {
            display: none;
          }
          .active-container {
            display: block;
          }
          .split-container {
            display: flex;
            gap: 20px;
          }
          .split-container .editor-content,
          .split-container .preview-content {
            flex: 1;
          }
          .split-container textarea {
            min-height: 350px;
          }
          .split-container .preview {
            min-height: 350px;
          }
          .buttons {
            text-align: center;
            margin-top: 20px;
          }
          .button {
            display: inline-block;
            padding: 10px 20px;
            color: white;
            background-color: #4CAF50;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 16px;
            text-decoration: none;
            margin: 0 10px;
          }
          .button-secondary {
            background-color: #2196F3;
          }
          .button:hover {
            opacity: 0.9;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Modifica il Messaggio</h1>
          
          <div class="form-group">
            <label>Email del lead:</label>
            <div class="email-display">${email}</div>
          </div>
          
          <div class="form-group">
            <div class="tabs">
              <div class="tab active" id="tab-edit">Modifica</div>
              <div class="tab" id="tab-preview">Anteprima</div>
              <div class="tab" id="tab-split">Vista Divisa</div>
            </div>
            
            <div class="editor-container active-container" id="container-edit">
              <div class="editor-content">
                <textarea id="message-editor">${decodeURIComponent(message)}</textarea>
              </div>
            </div>
            
            <div class="preview-container" id="container-preview">
              <div class="preview-content">
                <div class="preview" id="preview-content"></div>
              </div>
            </div>
            
            <div class="preview-container" id="container-split">
              <div class="split-container">
                <div class="editor-content">
                  <textarea id="message-editor-split">${decodeURIComponent(message)}</textarea>
                </div>
                <div class="preview-content">
                  <div class="preview" id="preview-content-split"></div>
                </div>
              </div>
            </div>
          </div>
          
          <div class="buttons">
            <button class="button" id="approve-button">Approva e Registra</button>
            <a href="javascript:history.back()" class="button button-secondary">Annulla</a>
          </div>
        </div>
        
        <script>
          // Inizializza Marked per renderizzare il markdown
          marked.setOptions({
            breaks: true, // Converte i ritorni a capo in <br>
            gfm: true,    // GitHub Flavored Markdown 
          });
          
          // Riferimenti agli elementi DOM
          const messageEditor = document.getElementById('message-editor');
          const messageEditorSplit = document.getElementById('message-editor-split');
          const previewContent = document.getElementById('preview-content');
          const previewContentSplit = document.getElementById('preview-content-split');
          const approveButton = document.getElementById('approve-button');
          
          // Tabs
          const tabEdit = document.getElementById('tab-edit');
          const tabPreview = document.getElementById('tab-preview');
          const tabSplit = document.getElementById('tab-split');
          
          // Containers
          const containerEdit = document.getElementById('container-edit');
          const containerPreview = document.getElementById('container-preview');
          const containerSplit = document.getElementById('container-split');
          
          // Funzione per aggiornare l'anteprima
          function updatePreview() {
            const markdownText = messageEditor.value;
            const htmlContent = marked.parse(markdownText);
            previewContent.innerHTML = htmlContent;
            
            // Aggiorna anche l'anteprima nella vista divisa
            messageEditorSplit.value = markdownText;
            previewContentSplit.innerHTML = htmlContent;
          }
          
          // Sincronizza le textarea
          function syncEditors(source) {
            if (source === 'main') {
              messageEditorSplit.value = messageEditor.value;
            } else {
              messageEditor.value = messageEditorSplit.value;
            }
            updatePreview();
          }
          
          // Gestione delle tab
          tabEdit.addEventListener('click', () => {
            tabEdit.classList.add('active');
            tabPreview.classList.remove('active');
            tabSplit.classList.remove('active');
            
            containerEdit.classList.add('active-container');
            containerPreview.classList.remove('active-container');
            containerSplit.classList.remove('active-container');
          });
          
          tabPreview.addEventListener('click', () => {
            tabEdit.classList.remove('active');
            tabPreview.classList.add('active');
            tabSplit.classList.remove('active');
            
            containerEdit.classList.remove('active-container');
            containerPreview.classList.add('active-container');
            containerSplit.classList.remove('active-container');
            
            updatePreview();
          });
          
          tabSplit.addEventListener('click', () => {
            tabEdit.classList.remove('active');
            tabPreview.classList.remove('active');
            tabSplit.classList.add('active');
            
            containerEdit.classList.remove('active-container');
            containerPreview.classList.remove('active-container');
            containerSplit.classList.add('active-container');
            
            syncEditors('main');
          });
          
          // Aggiornamenti in tempo reale
          messageEditor.addEventListener('input', () => syncEditors('main'));
          messageEditorSplit.addEventListener('input', () => syncEditors('split'));
          
          // Inizializza l'anteprima
          updatePreview();
          
          // Bottone di approvazione
          approveButton.addEventListener('click', () => {
            const modifiedMessage = encodeURIComponent(messageEditor.value);
            const approveUrl = '${approveBaseUrl}&message=' + modifiedMessage;
            window.location.href = approveUrl;
          });
        </script>
      </body>
      </html>
    `);

  } catch (error) {
    console.error('Errore nella gestione della modifica:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
} 