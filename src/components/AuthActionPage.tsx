import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { verifyPasswordResetCode, confirmPasswordReset } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useTranslation } from '../hooks/useTranslation';

export function AuthActionPage() {
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode');
  const oobCode = searchParams.get('oobCode');
  
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [email, setEmail] = useState('');
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    if (mode === 'resetPassword' && oobCode) {
      verifyPasswordResetCode(auth, oobCode)
        .then((email) => {
          setEmail(email);
          setValidating(false);
        })
        .catch((err) => {
          console.error(err);
          setError('Dieser Link ist ungültig oder abgelaufen. Wichtig: Wenn du mehrfach eine E-Mail angefordert hast, ist IMMER nur der Link der allerneusten E-Mail gültig!');
          setValidating(false);
        });
    } else {
      setError('Ungültige Anfrage.');
      setValidating(false);
    }
  }, [mode, oobCode]);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      setError('Das Passwort muss mindestens 6 Zeichen lang sein.');
      return;
    }
    setLoading(true);
    try {
      if (oobCode) {
        await confirmPasswordReset(auth, oobCode, newPassword);
        setSuccess(true);
      }
    } catch (err: any) {
      setError('Fehler beim Zurücksetzen: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (validating) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6">
        <div className="max-w-md w-full p-8 glass-effect border border-transparent rounded-3xl text-center dark:text-white">
          <p>Link wird überprüft...</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6">
        <div className="max-w-md w-full p-8 glass-effect border border-transparent rounded-3xl text-center dark:text-white">
          <h2 className="text-2xl font-bold mb-6 text-green-500">Erfolgreich!</h2>
          <p className="mb-6">Dein Passwort wurde erfolgreich geändert.</p>
          <button onClick={() => navigate('/login')} className="w-full bg-orange-500 hover:bg-orange-600 text-white p-3 rounded-lg font-bold transition-colors">
            Zum Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6">
      <div className="max-w-md w-full p-8 glass-effect border border-transparent rounded-3xl dark:text-white">
        <h2 className="text-2xl font-bold mb-6 text-center">Neues Passwort setzen</h2>
        
        {error ? (
          <div className="text-center">
            <p className="text-red-500 mb-6">{error}</p>
            <button onClick={() => navigate('/login')} className="w-full bg-orange-500 hover:bg-orange-600 text-white p-3 rounded-lg font-bold transition-colors">
              Zurück zum Login
            </button>
          </div>
        ) : (
          <form onSubmit={handleReset} className="space-y-4">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 text-center">Für Account: <strong>{email}</strong></p>
            <input
              type="password"
              placeholder="Neues Passwort (min. 6 Zeichen)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full p-4 rounded-xl border focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white/50 dark:bg-black/50 border-gray-200 dark:border-white/10 dark:text-white transition-all"
              autoFocus
            />
            <button 
              type="submit" 
              disabled={loading}
              className={`w-full p-3 rounded-lg font-bold text-white transition-colors ${loading ? 'bg-orange-400 cursor-not-allowed' : 'bg-orange-500 hover:bg-orange-600'}`}
            >
              {loading ? 'Wird gespeichert...' : 'Passwort speichern'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
