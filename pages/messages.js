import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function Messages() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [regenerating, setRegenerating] = useState(null);
  const router = useRouter();

  useEffect(() => {
    async function fetchData() {
      try {
        // Prima verifica l'autenticazione
        const authResponse = await fetch('/api/check-auth', {
          credentials: 'include' // Importante per inviare i cookie
        });
        
        if (!authResponse.ok) {
          console.error('Utente non autenticato:', await authResponse.text());
          router.push('/login');
          return;
        }
        
        // Poi carica i messaggi
        const messagesResponse = await fetch('/api/get-messages', {
          credentials: 'include' // Importante per inviare i cookie
        });
        
        if (!messagesResponse.ok) {
          if (messagesResponse.status === 401 || messagesResponse.status === 403) {
            console.error('Accesso non autorizzato');
            router.push('/login');
            return;
          }
          
          const errorData = await messagesResponse.json();
          throw new Error(errorData.error || 'Errore nel recupero dei messaggi');
        }
        
        const data = await messagesResponse.json();
        setMessages(data);
      } catch (err) {
        console.error('Errore:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [router]);

  const handleLogout = async () => {
    try {
      // Chiama un endpoint per cancellare i cookie
      await fetch('/api/logout', {
        method: 'POST',
        credentials: 'include'
      });
      
      router.push('/login');
    } catch (err) {
      console.error('Errore durante il logout:', err);
      // Forzare comunque il redirect al login
      router.push('/login');
    }
  };

  const handleReject = async (messageId) => {
    try {
      const response = await fetch('/api/reject', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ id: messageId })
      });

      if (!response.ok) {
        throw new Error('Errore nel reject del messaggio');
      }

      // Aggiorna lo stato locale del messaggio
      setMessages(messages.map(msg => 
        msg.id === messageId 
          ? { ...msg, status: 'rejected' } 
          : msg
      ));
    } catch (err) {
      console.error('Errore:', err);
      alert('Errore nel reject del messaggio');
    }
  };

  const handleRegenerate = async (messageId) => {
    try {
      setRegenerating(messageId);
      const response = await fetch('/api/regenerate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ id: messageId })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Errore nella rigenerazione della risposta');
      }

      const data = await response.json();

      // Aggiorna lo stato locale del messaggio con la nuova risposta
      setMessages(messages.map(msg => 
        msg.id === messageId 
          ? { ...msg, message_text: data.newText } 
          : msg
      ));
    } catch (err) {
      console.error('Errore:', err);
      alert('Errore nella rigenerazione della risposta: ' + err.message);
    } finally {
      setRegenerating(null);
    }
  };

  if (loading) return <div className="loading">Caricamento...</div>;
  if (error) return <div className="error">Errore: {error}</div>;

  return (
    <>
      <Head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </Head>
      <div className="container">
        <div className="header">
          <h1>Gestione Messaggi</h1>
          <button onClick={handleLogout} className="logout-button">Logout</button>
        </div>
        <div className="messages-grid">
          {messages.map((message) => (
            <div key={message.id} className="message-card">
              <div className="message-header">
                <h3>Messaggio #{message.id}</h3>
                <span className={`status ${message.status}`}>
                  {message.status}
                </span>
              </div>
              <div className="message-content">
                <div className="info-section">
                  <p className="label">Email</p>
                  <p className="value">{message.email}</p>
                </div>
                <div className="info-section">
                  <p className="label">Nome e cognome</p>
                  <p className="value">
                    {message.form_details ? 
                      `${JSON.parse(message.form_details).firstname || ''} ${JSON.parse(message.form_details).lastname || ''}`.trim() || 'Non specificato'
                      : 'Non specificato'
                    }
                  </p>
                </div>
                <div className="info-section">
                  <p className="label">Progetto</p>
                  <p className="value">
                    {message.form_details ? 
                      `${JSON.parse(message.form_details).project_type || ''}`.trim() || 'Non specificato'
                      : 'Non specificato'
                    }
                  </p>
                </div>
                <div className="info-section">
                  <p className="label">Budget</p>
                  <p className="value">
                    {message.form_details ? 
                      `${JSON.parse(message.form_details).budget || 'no budget'}`
                      : 'Non specificato'
                    }
                  </p>
                </div>
                <div className="info-section message-box">
                  <p className="label">Messaggio Originale</p>
                  <div className="message-text">{message.original_message}</div>
                </div>
                <div className="info-section message-box">
                  <p className="label">Risposta Generata</p>
                  <div className="message-text">{message.message_text}</div>
                </div>
              </div>
              <div className="message-actions">
                <a 
                  href={`/api/approve?id=${message.message_id}&email=${encodeURIComponent(message.email)}&skipHubspot=true`}
                  className="button edit"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Modifica e Invia
                </a>
                <a 
                  href={`/api/approve?id=${message.message_id}&email=${encodeURIComponent(message.email)}&skipHubspot=false`}
                  className="button send"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Invia e Salva su HubSpot
                </a>
                <button 
                  onClick={() => handleReject(message.message_id)}
                  className="button reject"
                  disabled={message.status === 'rejected'}
                >
                  Rifiuta
                </button>
                <button
                  onClick={() => handleRegenerate(message.message_id)}
                  className="button regenerate"
                  disabled={regenerating === message.message_id}
                >
                  {regenerating === message.message_id ? 'Rigenerando...' : 'Rigenera Risposta'}
                </button>
              </div>
            </div>
          ))}
        </div>

        <style jsx>{`
          .container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 2rem;
            font-family: 'Inter', sans-serif;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 2.5rem;
            padding-bottom: 1rem;
            border-bottom: 1px solid #e5e7eb;
          }
          .logout-button {
            padding: 0.75rem 1.5rem;
            background: #ef4444;
            color: white;
            border: none;
            border-radius: 0.5rem;
            cursor: pointer;
            font-weight: 500;
            transition: all 0.2s ease;
          }
          .logout-button:hover {
            background: #dc2626;
            transform: translateY(-1px);
          }
          h1 {
            color: #111827;
            margin: 0;
            font-size: 2rem;
            font-weight: 700;
          }
          .messages-grid {
            display: flex;
            flex-direction: column;
            gap: 1.5rem;
          }
          .message-card {
            background: white;
            border-radius: 1rem;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
            padding: 1.5rem;
            transition: transform 0.2s ease, box-shadow 0.2s ease;
            display: grid;
            grid-template-columns: 1fr 1fr 1fr 1fr;
            gap: 1.5rem;
          }
          .message-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
          }
          .message-header {
            grid-column: 1 / -1;
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1rem;
            padding-bottom: 1rem;
            border-bottom: 1px solid #e5e7eb;
          }
          .message-header h3 {
            color: #374151;
            font-size: 1.25rem;
            font-weight: 600;
            margin: 0;
          }
          .status {
            padding: 0.375rem 0.75rem;
            border-radius: 0.375rem;
            font-size: 0.875rem;
            font-weight: 500;
          }
          .status.pending {
            background: #fef3c7;
            color: #92400e;
          }
          .status.approved {
            background: #d1fae5;
            color: #065f46;
          }
          .status.rejected {
            background: #fee2e2;
            color: #991b1b;
          }
          .message-content {
            grid-column: 1 / -1;
            display: grid;
            grid-template-columns: 1fr 1fr 1fr 1fr;
            gap: 1.5rem;
          }
          .info-section {
            margin-bottom: 1rem;
          }
          .message-box {
            grid-column: span 2;
          }
          .label {
            color: #6b7280;
            font-size: 0.875rem;
            font-weight: 500;
            margin-bottom: 0.5rem;
          }
          .value {
            color: #111827;
            font-size: 1rem;
            margin: 0;
          }
          .message-text {
            background: #f9fafb;
            padding: 1rem;
            border-radius: 0.5rem;
            margin: 0.5rem 0;
            white-space: pre-wrap;
            font-size: 0.9375rem;
            line-height: 1.5;
            color: #374151;
          }
          .message-actions {
            grid-column: 1 / -1;
            display: flex;
            gap: 0.75rem;
            margin-top: 1rem;
            padding-top: 1rem;
            border-top: 1px solid #e5e7eb;
          }
          .button {
            display: inline-block;
            padding: 0.75rem 1.5rem;
            border-radius: 0.5rem;
            text-decoration: none;
            color: white;
            font-weight: 500;
            text-align: center;
            flex: 1;
            transition: all 0.2s ease;
          }
          .button.edit {
            background: #3b82f6;
          }
          .button.send {
            background: #10b981;
          }
          .button:hover {
            transform: translateY(-1px);
            opacity: 0.9;
          }
          .loading {
            text-align: center;
            padding: 2rem;
            font-size: 1.125rem;
            color: #6b7280;
          }
          .error {
            color: #ef4444;
            text-align: center;
            padding: 2rem;
            font-size: 1.125rem;
          }
          pre {
            background: #f9fafb;
            padding: 1rem;
            border-radius: 0.5rem;
            overflow-x: auto;
            font-size: 0.875rem;
            line-height: 1.5;
            color: #374151;
          }
          .message-text-wide {
            grid-column: span 2;
          }
          @media (max-width: 1200px) {
            .message-card {
              grid-template-columns: 1fr 1fr;
            }
            .message-content {
              grid-template-columns: 1fr 1fr;
            }
            .message-box {
              grid-column: span 1;
            }
          }
          @media (max-width: 768px) {
            .container {
              padding: 1rem;
            }
            .message-card {
              grid-template-columns: 1fr;
            }
            .message-content {
              grid-template-columns: 1fr;
            }
            .message-box {
              grid-column: span 1;
            }
            .message-actions {
              flex-direction: column;
            }
          }
          .button.reject {
            background-color: #ef4444;
            color: white;
            border: none;
            padding: 0.5rem 1rem;
            border-radius: 0.375rem;
            font-size: 0.875rem;
            font-weight: 500;
            cursor: pointer;
            transition: background-color 0.2s;
          }
          .button.reject:hover {
            background-color: #dc2626;
          }
          .button.reject:disabled {
            background-color: #fca5a5;
            cursor: not-allowed;
          }
          .button.regenerate {
            background-color: #6366f1;
            color: white;
            border: none;
            padding: 0.5rem 1rem;
            border-radius: 0.375rem;
            font-size: 0.875rem;
            font-weight: 500;
            cursor: pointer;
            transition: background-color 0.2s;
          }
          .button.regenerate:hover {
            background-color: #4f46e5;
          }
          .button.regenerate:disabled {
            background-color: #c7d2fe;
            cursor: not-allowed;
          }
        `}</style>
      </div>
    </>
  );
} 