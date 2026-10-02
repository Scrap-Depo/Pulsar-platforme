import { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { auth } from '../shared/lib/firebase';
import { message } from '../shared/lib/liveApi';
export default function HostLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [register, setRegister] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(reset = false) {
    if (busy) return;
    setBusy(true);
    setFeedback('');
    try {
      if (reset) {
        await sendPasswordResetEmail(auth, email);
        setFeedback('Если для этого адреса доступно восстановление, вы получите письмо.');
      } else if (register) await createUserWithEmailAndPassword(auth, email, password);
      else await signInWithEmailAndPassword(auth, email, password);
    } catch (e) {
      setFeedback(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="live-shell">
      <h1>Пульсар</h1>
      <form
        className="card entry-form"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <h2>{register ? 'Создать аккаунт ведущего' : 'Вход для ведущего'}</h2>
        <p>Аккаунт сохраняет доступ к вашим встречам на других устройствах.</p>
        <label>
          Email
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Пароль
          <input
            type="password"
            autoComplete={register ? 'new-password' : 'current-password'}
            minLength={8}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <button disabled={busy}>
          {busy ? 'Подождите…' : register ? 'Создать аккаунт' : 'Войти'}
        </button>
        <button type="button" onClick={() => setRegister(!register)}>
          {register ? 'Уже есть аккаунт' : 'Создать аккаунт'}
        </button>
        <button type="button" disabled={busy || !email} onClick={() => void submit(true)}>
          Восстановить пароль
        </button>
        <p role="status">{feedback}</p>
        <a href="/participant">Я участник встречи</a>
      </form>
    </main>
  );
}
