require('dotenv').config();
const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const crypto = require('crypto');

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;

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

// webhook hubspot
app.post('/hubspot-webhook', async (req, res) => {
  try {
    const leadData = req.body;
    
    // verifica che il form sia "contact form sito"
    const formName = leadData.properties.hs_form_name;
    if (!formName || formName !== "Contact form Sito") {
      console.log(`form ignorato: ${formName}`);
      return res.status(200).send('form ignorato');
    }

    console.log('lead ricevuto:', leadData);

    // invia i dati a openai assistant
    const qualificationText = await generateQualificationWithOpenAI(leadData);
    
    // invia messaggio su slack
    await sendSlackMessage(leadData, qualificationText);

    res.status(200).send('webhook processato');
  } catch (error) {
    console.error('errore nel webhook:', error);
    res.status(500).send('errore interno');
  }
});

// gestione interazioni Slack
app.post('/slack-interaction', async (req, res) => {
  try {
    // verifica firma Slack
    if (!verifySlackSignature(req)) {
      return res.status(401).send('firma non valida');
    }

    const payload = JSON.parse(req.body.payload);
    const action = payload.actions[0];
    const leadData = JSON.parse(action.value);

    if (action.value === 'approve') {
      // invia la risposta su HubSpot
      await sendHubSpotEmail(leadData, leadData.qualificationText);
      // aggiorna il messaggio Slack
      await updateSlackMessage(payload.response_url, 'Risposta approvata e inviata! ✅');
    } else if (action.value === 'modify') {
      // mostra modal per modificare
      await showModifyModal(payload.trigger_id, leadData);
    }

    res.status(200).send();
  } catch (error) {
    console.error('errore interazione slack:', error);
    res.status(500).send('errore interno');
  }
});

// funzione per inviare email su HubSpot
async function sendHubSpotEmail(leadData, message) {
  try {
    await axios.post(
      `https://api.hubapi.com/crm/v3/objects/emails`,
      {
        properties: {
          hs_email_direction: "OUTGOING",
          hs_email_status: "SENT",
          hs_email_subject: "Risposta alla tua richiesta",
          hs_email_text: message,
          hs_timestamp: Date.now(),
          hs_email_to_email: leadData.properties.email,
          hs_email_to_firstname: leadData.properties.firstname,
          hs_email_to_lastname: leadData.properties.lastname
        },
        associations: [
          {
            to: { id: leadData.properties.hs_object_id, type: "contact" },
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
async function showModifyModal(triggerId, leadData) {
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
                initial_value: leadData.qualificationText
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
async function generateQualificationWithOpenAI(leadData) {
  try {
    const response = await axios.post(
      `https://api.openai.com/v1/threads/${process.env.ASSISTANT_THREAD_ID}/messages`,
      {
        role: 'user',
        content: `analizza il lead: ${JSON.stringify(leadData)}`
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
async function sendSlackMessage(leadData, qualificationText) {
  try {
    await axios.post(
      'https://slack.com/api/chat.postMessage',
      {
        channel: process.env.SLACK_CHANNEL_ID,
        text: `nuovo lead: ${leadData.properties.email}`,
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
                value: JSON.stringify({ ...leadData, qualificationText })
              },
              { 
                type: 'button', 
                text: { type: 'plain_text', text: 'modifica' }, 
                value: JSON.stringify({ ...leadData, qualificationText })
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
