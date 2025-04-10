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

    if (password === process.env.ADMIN_PASSWORD || password === process.env.NEXT_PUBLIC_ADMIN_PASSWORD) {
      // Usa una secret di fallback se JWT_SECRET non è definito
      const jwtSecret = process.env.JWT_SECRET || 'default_jwt_secret_change_in_production';
      
      // Genera un token JWT valido per 24 ore
      const token = jwt.sign(
        { role: 'admin' },
        jwtSecret,
        { expiresIn: '24h' }
      );

      // Determina il dominio
      const isProduction = process.env.NODE_ENV === 'production';
      
      // Imposta i cookie con opzioni appropriate
      res.setHeader('Set-Cookie', [
        `auth=${token}; HttpOnly; ${isProduction ? 'Secure;' : ''} SameSite=Lax; Path=/; Max-Age=86400`,
        `isAuthenticated=true; Path=/; ${isProduction ? 'Secure;' : ''} SameSite=Lax; Max-Age=86400`
      ]);

      console.log('Autenticazione riuscita, cookie impostati');
      return res.status(200).json({ success: true });
    }

    return res.status(401).json({ error: 'Password errata' });
  } catch (error) {
    console.error('Errore durante l\'autenticazione:', error);
    return res.status(500).json({ error: 'Errore interno del server' });
  }
} 