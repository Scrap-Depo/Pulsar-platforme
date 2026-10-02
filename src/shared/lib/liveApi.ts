import { httpsCallable } from 'firebase/functions';
import { api, auth } from './firebase';
export async function command<T = Record<string, unknown>>(
  action: string,
  data: Record<string, unknown> = {},
): Promise<T> {
  if (!navigator.onLine)
    throw new Error('Нет соединения. Данные не отправлены; повторите после восстановления связи.');
  if (import.meta.env.VITE_API_TRANSPORT === 'vercel') {
    const user = auth.currentUser;
    if (!user) throw new Error('Войдите в приложение.');
    const token = await user.getIdToken();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch('/api/pulsar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...data, action }),
        signal: controller.signal,
      });
      if (!response.headers.get('content-type')?.includes('application/json')) {
        throw new Error('Сервер встреч недоступен. Проверьте публикацию API на Vercel.');
      }
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message || 'Не удалось выполнить действие.');
      return result.data as T;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Подтверждение не получено. Повторите отправку: сохранённый ответ не будет продублирован.');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
  const result = await httpsCallable<Record<string, unknown>, T>(api, 'pulsar', { timeout: 30000 })(
    { ...data, action },
  );
  return result.data;
}
export function message(error: unknown) {
  const text = error instanceof Error ? error.message : 'Не удалось выполнить действие.';
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  const detail = `${code} ${text}`;
  if (
    /auth\/(invalid-credential|invalid-login-credentials|wrong-password|user-not-found)/i.test(
      detail,
    )
  )
    return 'Не удалось войти. Проверьте email и пароль.';
  if (/auth\/email-already-in-use/i.test(detail))
    return 'Для этого email уже есть аккаунт. Войдите или восстановите пароль.';
  if (/auth\/operation-not-allowed/i.test(detail))
    return 'Этот способ входа ещё не включён в настройках приложения. Обратитесь к ведущему или администратору.';
  if (/auth\/too-many-requests/i.test(detail))
    return 'Слишком много попыток. Подождите и повторите вход.';
  if (/deadline-exceeded|timeout/i.test(detail))
    return 'Подтверждение не получено. Повторите отправку: сохранённый ответ не будет продублирован.';
  if (/unavailable|network|internal/i.test(detail))
    return 'Нет ответа от сервера. Проверьте соединение и повторите. Если это первый запуск, проверьте публикацию серверной функции.';
  if (/permission-denied|insufficient permissions/i.test(detail))
    return 'Нет доступа к данным. Встреча могла быть удалена; проверьте вход и настройки доступа.';
  return text.replace(/^Firebase:\s*/, '');
}
export function download(data: unknown, name: string) {
  const link = document.createElement('a');
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' }),
  );
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
