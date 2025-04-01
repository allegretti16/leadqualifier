require('dotenv').config();
const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const crypto = require('crypto');

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;

// variabile per tenere traccia dell'ultimo contatto processato
let lastProcessedContactId = null;

// funzione per recuperare i nuovi contatti da HubSpot
async function checkNewContacts() {
  try {
    const response = await axios.get(
      'https://api.hubapi.com/crm/v3/objects/contacts',
      {
        params: {
          limit: 10,
          properties: ['email', 'firstname', 'lastname', 'company', 'message', 'project_type', 'budget'],
          sorts: [{ propertyName: "createdate", direction: "DESCENDING" }]
        },
        headers: {
          'Authorization': `Bearer ${process.env.HUBSPOT_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const contacts = response.data.results;
    
    // se è la prima volta, salva l'ID dell'ultimo contatto
    if (!lastProcessedContactId) {
      lastProcessedContactId = contacts[0]?.id;
      return;
    }

    // processa solo i nuovi contatti
    for (const contact of contacts) {
      if (contact.id === lastProcessedContactId) break;
      
      console.log('nuovo lead trovato:', contact);
      
      // invia i dati a openai assistant
      const qualificationText = await generateQualificationWithOpenAI(contact);
      
      // invia messaggio su slack
      await sendSlackMessage(contact, qualificationText);
    }

    // aggiorna l'ID dell'ultimo contatto processato
    lastProcessedContactId = contacts[0]?.id;
  } catch (error) {
    console.error('errore nel recupero contatti:', error);
  }
}

// avvia il polling ogni 5 minuti
setInterval(checkNewContacts, 5 * 60 * 1000);

// endpoint per ricevere le submission del form HubSpot
app.post('/hubspot-form-submission', async (req, res) => {
  try {
    const formData = req.body;
    console.log('nuova submission ricevuta:', formData);

    // invia i dati a openai assistant
    const qualificationText = await generateQualificationWithOpenAI(formData);
    
    // invia messaggio su slack
    await sendSlackMessage(formData, qualificationText);

    res.status(200).send('submission processata');
  } catch (error) {
    console.error('errore nella submission:', error);
    res.status(500).send('errore interno');
  }
});

// verifica firma Slack
function verifySlackSignature(req) {
  const timestamp = req.headers['x-slack-request-timestamp'];
  const signature = req.headers['x-slack-signature'];
  const body = JSON.stringify(req.body);
  const sigBasestring = `v0:${timestamp}:${body}`;
  const mySignature = 'v0=' + crypto.createHmac('sha256', process.env.SLACK_SIGNING_SECRET)
    .update(sigBasestring)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(mySignature),
    Buffer.from(signature)
  );
}

// gestione interazioni Slack
app.post('/slack-interaction', async (req, res) => {
  try {
    // verifica firma Slack
    if (!verifySlackSignature(req)) {
      return res.status(401).send('firma non valida');
    }

    const payload = JSON.parse(req.body.payload);
    const action = payload.actions[0];
    const formData = JSON.parse(action.value);

    if (action.value === 'approve') {
      // invia la risposta su HubSpot
      await sendHubSpotEmail(formData, formData.qualificationText);
      // aggiorna il messaggio Slack
      await updateSlackMessage(payload.response_url, 'Risposta approvata e inviata! ✅');
    } else if (action.value === 'modify') {
      // mostra modal per modificare
      await showModifyModal(payload.trigger_id, formData);
    }

    res.status(200).send();
  } catch (error) {
    console.error('errore interazione slack:', error);
    res.status(500).send('errore interno');
  }
});

// funzione per inviare email su HubSpot
async function sendHubSpotEmail(formData, message) {
  try {
    // Prima troviamo il contatto tramite email
    const contactResponse = await axios.get(
      `https://api.hubapi.com/crm/v3/objects/contacts/search`,
      {
        params: {
          q: formData.email,
          properties: ['hs_object_id']
        },
        headers: {
          'Authorization': `Bearer ${process.env.HUBSPOT_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!contactResponse.data.results || contactResponse.data.results.length === 0) {
      throw new Error('Contatto non trovato');
    }

    const contactId = contactResponse.data.results[0].id;

    // Ora inviamo l'email
    await axios.post(
      'https://api.hubapi.com/crm/v3/objects/emails',
      {
        properties: {
          hs_email_direction: "OUTGOING",
          hs_email_status: "SENT",
          hs_email_subject: "Risposta alla tua richiesta",
          hs_email_text: message,
          hs_timestamp: Date.now(),
          hs_email_to_email: formData.email,
          hs_email_to_firstname: formData.firstname,
          hs_email_to_lastname: formData.lastname
        },
        associations: [
          {
            to: { id: contactId, type: "contact" },
            types: [{ category: "HUBSPOT_DEFINED", typeId: 1 }]
          }
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.HUBSPOT_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (error) {
    console.error('errore invio hubspot:', error);
    throw error;
  }
}

// funzione per aggiornare il messaggio Slack
async function updateSlackMessage(responseUrl, text) {
  try {
    await axios.post(responseUrl, {
      text: text
    });
  } catch (error) {
    console.error('errore aggiornamento slack:', error);
  }
}

// funzione per mostrare il modal di modifica
async function showModifyModal(triggerId, formData) {
  try {
    await axios.post(
      'https://slack.com/api/views.open',
      {
        trigger_id: triggerId,
        view: {
          type: 'modal',
          callback_id: 'modify_response',
          title: { type: 'plain_text', text: 'Modifica risposta' },
          submit: { type: 'plain_text', text: 'Invia' },
          blocks: [
            {
              type: 'input',
              block_id: 'response_text',
              element: {
                type: 'plain_text_input',
                multiline: true,
                initial_value: formData.qualificationText
              },
              label: { type: 'plain_text', text: 'Risposta' }
            }
          ]
        }
      },
      {
        headers: {
          authorization: `bearer ${process.env.SLACK_BOT_TOKEN}`,
          'content-type': 'application/json'
        }
      }
    );
  } catch (error) {
    console.error('errore apertura modal:', error);
  }
}

// funzione per chiamare openai assistant
async function generateQualificationWithOpenAI(formData) {
  try {
    const response = await axios.post(
      `https://api.openai.com/v1/threads/${process.env.ASSISTANT_THREAD_ID}/messages`,
      {
        role: 'user',
        content: `analizza la richiesta: ${JSON.stringify(formData)}`
      },
      {
        headers: {
          'authorization': `bearer ${process.env.OPENAI_API_KEY}`,
          'content-type': 'application/json'
        }
      }
    );
    return response.data.choices[0]?.message?.content || 'testo non generato';
  } catch (error) {
    console.error('errore openai:', error);
    return 'errore nella generazione';
  }
}

// funzione per inviare un messaggio su slack
async function sendSlackMessage(formData, qualificationText) {
  try {
    await axios.post(
      'https://slack.com/api/chat.postMessage',
      {
        channel: process.env.SLACK_CHANNEL_ID,
        text: `nuova richiesta da: ${formData.email}`,
        blocks: [
          {
            type: 'section',
            text: { type: 'mrkdwn', text: qualificationText }
          },
          {
            type: 'actions',
            elements: [
              { 
                type: 'button', 
                text: { type: 'plain_text', text: 'approva' }, 
                value: JSON.stringify({ ...formData, qualificationText })
              },
              { 
                type: 'button', 
                text: { type: 'plain_text', text: 'modifica' }, 
                value: JSON.stringify({ ...formData, qualificationText })
              }
            ]
          }
        ]
      },
      {
        headers: {
          authorization: `bearer ${process.env.SLACK_BOT_TOKEN}`,
          'content-type': 'application/json'
        }
      }
    );
  } catch (error) {
    console.error('errore invio slack:', error);
  }
}

app.listen(PORT, () => console.log(`server avviato su http://localhost:${PORT}`));
