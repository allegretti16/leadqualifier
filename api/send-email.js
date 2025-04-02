const { google } = require('googleapis');
const nodemailer = require('nodemailer');

// Configurazione delle credenziali OAuth2
const oAuth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'https://leadqualifier.vercel.app/api/auth/callback'
);

oAuth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN
});

// Funzione per inviare email con Gmail API
async function sendGmailEmail(to, subject, text) {
  try {
    // Ottieni un nuovo token di accesso
    const accessToken = await oAuth2Client.getAccessToken();

    // Crea un transporter nodemailer con le credenziali OAuth2
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: 'allegretti@extendi.it', // Usa l'email appropriata configurata con OAuth
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
        accessToken: accessToken.token
      }
    });

    // Opzioni email
    const mailOptions = {
      from: 'Dario Calamandrei <hello@extendi.it>',
      to: to,
      subject: subject,
      text: text
    };

    // Invia l'email
    const result = await transporter.sendMail(mailOptions);
    console.log('Email inviata con successo:', result);
    return result;
  } catch (error) {
    console.error('Errore nell\'invio dell\'email:', error);
    throw error;
  }
}

// API endpoint per inviare l'email
export default async function handler(req, res) {
  // Gestisci preflight CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  // Abilita CORS per tutti gli altri metodi
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    // Verifica che ci siano i dati richiesti per POST
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Metodo non consentito' });
    }

    // Estrai il corpo della richiesta
    let emailData;
    try {
      if (typeof req.body === 'string') {
        emailData = JSON.parse(req.body);
      } else {
        emailData = req.body;
      }
    } catch (error) {
      console.error('Errore nel parsing del corpo:', error);
      return res.status(400).json({ error: 'Corpo della richiesta non valido' });
    }

    // Verifica che ci siano i campi necessari
    if (!emailData.to || !emailData.message) {
      return res.status(400).json({ error: 'Campi to e message richiesti' });
    }

    // Invia l'email
    const subject = emailData.subject || 'Grazie per averci contattato';
    await sendGmailEmail(emailData.to, subject, emailData.message);

    // Invia messaggio di conferma a Slack (opzionale)
    if (emailData.notifySlack) {
      try {
        const message = `✉️ *EMAIL INVIATA* - La risposta per ${emailData.to} è stata inviata con successo.`;
        await fetch("https://slack.com/api/chat.postMessage", {
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
      } catch (slackError) {
        console.error('Errore nella notifica a Slack:', slackError);
        // Non bloccare l'operazione principale se la notifica fallisce
      }
    }

    // Restituisci una risposta di successo
    return res.status(200).json({
      success: true,
      message: 'Email inviata con successo',
    });
  } catch (error) {
    console.error('Errore nella gestione della richiesta:', error);
    return res.status(500).json({ error: error.message });
  }
}

// Esporta la funzione di invio email per utilizzo diretto da altri moduli
export { sendGmailEmail }; 