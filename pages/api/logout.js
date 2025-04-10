export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non consentito' });
  }

  try {
    // Cancella i cookie di autenticazione impostando una data di scadenza passata
    res.setHeader('Set-Cookie', [
      `auth=; HttpOnly; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure; SameSite=Lax`,
      `isAuthenticated=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure; SameSite=Lax`
    ]);

    return res.status(200).json({ success: true, message: 'Logout effettuato con successo' });
  } catch (error) {
    console.error('Errore durante il logout:', error);
    return res.status(500).json({ error: 'Errore interno del server' });
  }
} 