import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
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
  const [showPassword, setShowPassword] = useState(false);
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
        setFeedback(
          auth.emulatorConfig
            ? 'Локальная проверка: настоящие письма не отправляются. Ссылка восстановления доступна в журнале эмулятора. Используйте её, чтобы задать новый пароль.'
            : 'Если для этого адреса доступно восстановление, вы получите письмо.',
        );
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
        <p>
          {auth.emulatorConfig
            ? 'Локальная проверка: аккаунты и встречи отделены от опубликованного приложения. Письма на почту не отправляются.'
            : 'Аккаунт сохраняет доступ к вашим встречам на других устройствах.'}
        </p>
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
        <div>
          <label htmlFor="host-password">Пароль</label>
          <div className="password-field">
          <input
            id="host-password"
            type={showPassword ? 'text' : 'password'}
            autoComplete={register ? 'new-password' : 'current-password'}
            minLength={8}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="button"
            className="password-toggle"
            aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
            title={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
            aria-controls="host-password"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
          </button>
          </div>
        </div>
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
