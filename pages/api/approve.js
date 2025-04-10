import { sendGmailEmail } from './send-email';
import { getMessage, updateMessage } from '../../utils/supabase';
import { authMiddleware } from '../../middleware/authMiddleware';
import { supabaseAdmin } from '../../utils/supabase';

// Funzione per inviare messaggio di conferma a Slack
async function sendApprovalConfirmationToSlack(email) {
  try {
    const message = `✅ *SALVATA E INVIATA* - La risposta per ${email} è stata inviata e registrata in HubSpot`;
    
    const result = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
      },
      body: JSON.stringify({
        channel: process.env.SLACK_CHANNEL_ID,
        text: message,
        unfurl_links: false
      }),
    });

    if (!result.ok) {
      throw new Error(`Errore Slack: ${result.statusText}`);
    }

    console.log('Messaggio di conferma inviato a Slack');
    return result.json();
  } catch (error) {
    console.error('Errore nell\'invio della conferma a Slack:', error);
    // Non far fallire tutta l'approvazione se non riusciamo a inviare la conferma
  }
}

// Funzione helper per ottenere l'URL base
function getBaseUrl() {
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3000';
  } else {
    return 'https://leadqualifier.vercel.app';
  }
}

// Endpoint protetto con il middleware di autenticazione
async function handler(req, res) {
  const { id, email, skipHubspot } = req.query;

  if (!id || !email) {
    return res.status(400).json({ error: 'ID e email sono richiesti' });
  }

  try {
    // Resto della tua logica per approvare i messaggi
    // ...

    // Esempio:
    // 1. Aggiorna lo stato del messaggio a 'approved'
    const { data, error } = await supabaseAdmin
      .from('messages')
      .update({ status: 'approved' })
      .eq('message_id', id)
      .select();

    if (error) {
      console.error('Errore nell\'aggiornamento del messaggio:', error);
      return res.status(500).json({ error: error.message });
    }

    // 2. Se skipHubspot non è true, invia i dati a HubSpot
    // ...

    return res.status(200).json({ success: true, data });
  } catch (err) {
    console.error('Errore nell\'approvazione del messaggio:', err);
    return res.status(500).json({ error: 'Errore del server' });
  }
}

// Applica il middleware di autenticazione
export default authMiddleware(handler);

// funzione per inviare email su HubSpot
export async function sendHubSpotEmail(email, message, formDetailsString) {
  try {
    console.log('Invio email a:', email);
    console.log('formDetailsString tipo:', typeof formDetailsString);
    console.log('Valore completo formDetailsString:', formDetailsString);
    
    // Costruisci l'intestazione dell'email
    const oggetto = "Grazie per averci contattato";

    // Prepara il corpo dell'email con le informazioni di contesto
    let emailBody = message;
    
    // Se ci sono i dettagli del form, li aggiungiamo in fondo
    if (formDetailsString) {
      try {
        // Verifica il tipo di formDetailsString e gestisci tutti i casi possibili
        let formDetailsObj;
        
        if (typeof formDetailsString === 'object' && formDetailsString !== null) {
          // Già un oggetto
          formDetailsObj = formDetailsString;
          console.log('FormDetails è già un oggetto:', formDetailsObj);
        } else if (typeof formDetailsString === 'string') {
          // Stringa JSON o stringa URL-encoded
          let jsonStr = formDetailsString;
          console.log('FormDetails è una stringa, lunghezza:', formDetailsString.length);
          
          // Se è una stringa URL-encoded, decodificala
          if (formDetailsString.includes('%')) {
            try {
              console.log('Provo a decodificare URL-encoded string...');
              jsonStr = decodeURIComponent(formDetailsString);
              console.log('Stringa decodificata con successo, lunghezza:', jsonStr.length);
            } catch (e) {
              console.error('Errore nella decodifica URL:', e);
            }
          }
          
          // Tenta di parsare il JSON
          try {
            console.log('Provo a parsare il JSON...');
            formDetailsObj = JSON.parse(jsonStr);
            console.log('JSON parsato con successo:', formDetailsObj);
          } catch (e) {
            console.error('Errore nel parsing JSON:', e);
            console.error('Contenuto che ha causato errore:', jsonStr);
            // Fallback di sicurezza
            formDetailsObj = {};
          }
        } else {
          // Fallback per altri casi
          console.log('FormDetails non è né un oggetto né una stringa:',
                      typeof formDetailsString);
          formDetailsObj = {};
        }
        
        // Assicuriamoci che formDetailsObj sia un oggetto valido
        if (formDetailsObj && typeof formDetailsObj === 'object') {
          emailBody += `\n\n------------------\n`;
          emailBody += `INFORMAZIONI RICHIESTA ORIGINALE:\n\n`;
          
          if (formDetailsObj.firstname || formDetailsObj.lastname) {
            emailBody += `Nome: ${formDetailsObj.firstname || ''} ${formDetailsObj.lastname || ''}\n`;
          }
          
          if (formDetailsObj.company) {
            emailBody += `Azienda: ${formDetailsObj.company}\n`;
          }
          
          if (formDetailsObj.project_type) {
            emailBody += `Tipo Progetto: ${formDetailsObj.project_type}\n`;
          }
          
          if (formDetailsObj.budget) {
            emailBody += `Budget: ${formDetailsObj.budget}\n`;
          }
          
          if (formDetailsObj.message) {
            emailBody += `\nMessaggio Originale:\n${formDetailsObj.message}\n`;
          }
        }
        
      } catch (error) {
        console.error('Errore nel parsing dei dettagli del form:', error);
        console.error('Dettagli ricevuti:', formDetailsString);
        // Continuiamo senza aggiungere i dettagli
      }
    }

    // Invia prima l'email tramite Gmail API
    await sendGmailEmail(email, oggetto, emailBody);
    
    // Usa l'API di engagement di HubSpot per registrare l'attività email
    const engagementUrl = 'https://api.hubapi.com/engagements/v1/engagements';
    const engagementPayload = {
      engagement: {
        type: "EMAIL",
        timestamp: Date.now()
      },
      associations: {
        contactIds: []  // Verrà popolato dopo aver trovato il contatto
      },
      metadata: {
        from: {
          email: "hello@extendi.it",
          firstName: "Dario",
          lastName: "Calamandrei"
        },
        to: [{ email: email }],
        subject: oggetto,
        text: emailBody
      }
    };
    
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
    
    console.log('Contatto trovato:', contactId);
    
    // Aggiorniamo l'associazione con l'ID del contatto come stringa
    engagementPayload.associations.contactIds = [contactId];
    
    // Inviamo l'engagement
    const engagementResponse = await fetch(engagementUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.HUBSPOT_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(engagementPayload)
    });
    
    // Verifichiamo la risposta
    if (!engagementResponse.ok) {
      const errorText = await engagementResponse.text();
      console.error('Risposta errore HubSpot:', errorText);
      
      // Piano B: se fallisce l'engagement, proviamo con una nota semplice
      const noteUrl = `https://api.hubapi.com/crm/v3/objects/notes`;
      const noteBody = {
        properties: {
          hs_note_body: `Email inviata a ${email}:\n\n${emailBody}`,
          hs_timestamp: Date.now()
        }
      };
      
      // Creiamo la nota
      const noteResponse = await fetch(noteUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.HUBSPOT_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(noteBody)
      });
      
      if (!noteResponse.ok) {
        const noteErrorText = await noteResponse.text();
        console.error('Errore creazione nota:', noteErrorText);
        throw new Error(`Errore HubSpot: ${noteResponse.status} ${noteResponse.statusText}`);
      }
      
      const noteData = await noteResponse.json();
      console.log('Nota creata:', noteData.id);
      
      // Ora associamo la nota al contatto
      const noteId = noteData.id;
      const associationUrl = `https://api.hubapi.com/crm/v3/objects/notes/${noteId}/associations/contacts/${contactId}`;
      
      const associationResponse = await fetch(associationUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${process.env.HUBSPOT_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!associationResponse.ok) {
        const associationErrorText = await associationResponse.text();
        console.error('Errore associazione nota:', associationErrorText);
        throw new Error(`Errore HubSpot: ${associationResponse.status} ${associationResponse.statusText}`);
      }
      
      console.log('Nota associata al contatto con successo');
    }
    
    console.log('Email inviata e registrata in HubSpot con successo');
  } catch (error) {
    console.error('Errore nell\'invio dell\'email:', error);
    throw error;
  }
}