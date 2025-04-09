import { WebClient } from '@slack/web-api';

const slackClient = new WebClient(process.env.SLACK_BOT_TOKEN);

export default async function handler(req, res) {
  try {
    // Prova a inviare un messaggio di test
    const result = await slackClient.chat.postMessage({
      channel: process.env.SLACK_CHANNEL_ID,
      text: 'Test di connessione Slack',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*Test di connessione Slack*'
          }
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `Test inviato il ${new Date().toLocaleString()}`
            }
          ]
        }
      ]
    });

    console.log('Risultato test Slack:', result);

    return res.status(200).json({
      success: true,
      result
    });
  } catch (error) {
    console.error('Errore nel test Slack:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
} 