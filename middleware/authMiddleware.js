import jwt from 'jsonwebtoken';

export function authMiddleware(handler) {
  return async (req, res) => {
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
        
        // Aggiungi l'utente decodificato alla richiesta
        req.user = decoded;
      } catch (jwtError) {
        console.error('Errore nella verifica del token JWT:', jwtError);
        return res.status(401).json({ error: 'Non autorizzato: token invalido' });
      }

      // Passa al gestore della richiesta
      return handler(req, res);
    } catch (err) {
      console.error('Errore nel middleware di autenticazione:', err);
      return res.status(500).json({ error: 'Errore del server' });
    }
  };
} 