import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
  try {
    // Ottieni il token JWT dal cookie
    const token = req.cookies.auth;
    
    if (!token) {
      return res.status(401).json({ error: 'Non autorizzato: token mancante' });
    }
    
    // Verifica il token JWT
    try {
      const jwtSecret = process.env.JWT_SECRET || 'default_jwt_secret_change_in_production';
      const decoded = jwt.verify(token, jwtSecret);
      
      // Verifica che il ruolo sia 'admin'
      if (decoded.role !== 'admin') {
        return res.status(403).json({ error: 'Accesso negato: ruolo non autorizzato' });
      }
      
      // Token valido
      return res.status(200).json({ authenticated: true });
    } catch (jwtError) {
      console.error('Errore nella verifica del token JWT:', jwtError);
      return res.status(401).json({ error: 'Non autorizzato: token invalido' });
    }
  } catch (err) {
    console.error('Errore nel controllo dell\'autenticazione:', err);
    return res.status(500).json({ error: 'Errore del server' });
  }
} 