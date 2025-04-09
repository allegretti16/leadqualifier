import { WebClient } from '@slack/web-api';

const slackClient = new WebClient(process.env.SLACK_BOT_TOKEN);

export async function sendApprovalConfirmationToSlack(channelId, messageId, email) {
  try {
    await slackClient.chat.postMessage({
      channel: channelId,
      text: `✅ Messaggio approvato e inviato a ${email}`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `✅ *Messaggio approvato e inviato a ${email}*`
          }
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `ID messaggio: ${messageId}`
            }
          ]
        }
      ]
    });
  } catch (error) {
    console.error('Errore nell\'invio della conferma a Slack:', error);
    throw error;
  }
} 