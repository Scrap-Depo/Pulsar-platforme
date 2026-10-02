import { useEffect, useState } from 'react';
import { onAuthStateChanged, signInAnonymously, User } from 'firebase/auth';
import { auth, configurationError } from '../shared/lib/firebase';
import { message } from '../shared/lib/liveApi';
import HostLogin from '../pages/HostLogin';
import Audience from '../pages/Audience';
import MeetingAdmin from '../pages/MeetingAdmin';
export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const audience = ['/participant', '/projector'].includes(location.pathname);
  useEffect(() => {
    if (configurationError) return;
    let signingIn = false;
    return onAuthStateChanged(auth, (next) => {
      setUser(next);
      if (!next && audience && !signingIn) {
        signingIn = true;
        signInAnonymously(auth)
          .catch((e) => {
            setError(message(e));
            setReady(true);
          })
          .finally(() => {
            signingIn = false;
          });
      } else setReady(true);
    });
  }, [audience]);
  if (configurationError || error)
    return (
      <main className="live-shell">
        <h1>Пульсар</h1>
        <p role="alert">{configurationError || error}</p>
        <button onClick={() => location.reload()}>Повторить подключение</button>
      </main>
    );
  if (!ready) return <main className="live-shell">Подключаемся…</main>;
  if (audience)
    return user ? (
      <Audience user={user} viewer={location.pathname === '/projector'} />
    ) : (
      <p>Подключаемся…</p>
    );
  return (
    <>
      {import.meta.env.VITE_USE_EMULATORS === 'true' && (
        <p className="test-environment">Тестовая среда. Встречи и ответы временные.</p>
      )}
      {user && !user.isAnonymous ? <MeetingAdmin user={user} /> : <HostLogin />}
    </>
  );
}
