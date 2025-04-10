import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non consentito' });
  }

  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Password mancante' });
    }

    if (password === process.env.ADMIN_PASSWORD) {
      // Genera un token JWT valido per 24 ore
      const token = jwt.sign(
        { role: 'admin' },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      // Imposta il cookie HTTP-only
      res.setHeader('Set-Cookie', [
        `auth=${token}; HttpOnly; Secure; SameSite=Strict; Path=/`,
        `isAuthenticated=true; Path=/`
      ]);

      return res.status(200).json({ success: true });
    }

    return res.status(401).json({ error: 'Password errata' });
  } catch (error) {
    console.error('Errore durante l\'autenticazione:', error);
    return res.status(500).json({ error: 'Errore interno del server' });
  }
} 