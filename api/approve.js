const { OpenAI } = require('openai');

export default async function handler(req, res) {
  // Abilita CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  try {
    const { email, message } = req.query;
    
    if (!email || !message) {
      return res.status(400).json({ error: 'Email e messaggio sono richiesti' });
    }

    console.log('Approvazione ricevuta per:', email);
    console.log('Messaggio da inviare:', message);

    // Invia l'email tramite HubSpot
    await sendHubSpotEmail(email, message);
    
    // Restituisci una pagina HTML di conferma
    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Email Approvata</title>
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
            .success-icon {
              color: #2ecc71;
              font-size: 48px;
              margin-bottom: 20px;
            }
            p {
              color: #666;
              line-height: 1.6;
            }
            .email-details {
              margin-top: 20px;
              padding: 15px;
              background-color: #f9f9f9;
              border-radius: 4px;
              text-align: left;
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
            <div class="success-icon">✓</div>
            <h1>Email Approvata e Inviata</h1>
            <p>L'email è stata approvata e inviata con successo a <strong>${email}</strong>.</p>
            <div class="email-details">
              <p><strong>Messaggio inviato:</strong></p>
              <p>${message.replace(/\n/g, '<br>')}</p>
            </div>
            <a href="javascript:window.close()" class="button">Chiudi questa finestra</a>
          </div>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Errore durante l\'approvazione:', error);
    res.status(500).json({ error: 'Errore durante l\'invio dell\'email' });
  }
}

// funzione per inviare email su HubSpot
async function sendHubSpotEmail(email, message) {
  try {
    console.log('Ricerca contatto HubSpot per:', email);
    
    // Prima troviamo il contatto tramite email
    const searchUrl = `https://api.hubapi.com/crm/v3/objects/contacts/search`;
    const searchBody = {
      filterGroups: [{
        filters: [{
          propertyName: "email",
          operator: "EQ",
          value: email
        }]
      }],
      properties: ["firstname", "lastname", "hs_object_id"]
    };
    
    const contactResponse = await fetch(searchUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.HUBSPOT_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(searchBody)
    });

    const contactData = await contactResponse.json();
    console.log('Risposta ricerca contatto:', JSON.stringify(contactData, null, 2));
    
    if (!contactData.results || contactData.results.length === 0) {
      throw new Error('Contatto non trovato');
    }

    const contact = contactData.results[0];
    const contactId = contact.id;
    const firstname = contact.properties.firstname || '';
    const lastname = contact.properties.lastname || '';

    console.log('Contatto trovato:', contactId);
    
    // Inviamo la nota invece dell'email, è più affidabile
    const noteUrl = 'https://api.hubapi.com/crm/v3/objects/notes';
    const noteBody = {
      properties: {
        hs_note_body: message,
        hs_timestamp: Date.now()
      },
      associations: [
        {
          to: { id: contactId },
          types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 181 }]
        }
      ]
    };
    
    const noteResponse = await fetch(noteUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.HUBSPOT_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(noteBody)
    });

    if (!noteResponse.ok) {
      const errorText = await noteResponse.text();
      console.error('Risposta errore HubSpot:', errorText);
      throw new Error(`Errore HubSpot: ${noteResponse.status} ${noteResponse.statusText}`);
    }
    
    const noteData = await noteResponse.json();
    console.log('Nota creata:', noteData.id);
    
    return noteData;
  } catch (error) {
    console.error('Errore nell\'invio a HubSpot:', error);
    throw error;
  }
} 