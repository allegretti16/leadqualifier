require('dotenv').config();
const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;

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
              { type: 'button', text: { type: 'plain_text', text: 'approva' }, value: 'approve' },
              { type: 'button', text: { type: 'plain_text', text: 'modifica' }, value: 'modify' }
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
