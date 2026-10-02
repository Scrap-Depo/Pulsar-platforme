import { useState } from 'react';
import { User } from 'firebase/auth';
import { Room, PublicResponse, OwnAnswers } from '../shared/types/live';
import { useLiveDoc, useLiveList, useOnline } from '../shared/hooks/useLiveData';
import { command, message } from '../shared/lib/liveApi';
import ResponseForm from './ResponseForm';
import LiveResults from './LiveResults';
import JoinQr from '../shared/ui/JoinQr';
export default function Audience({ user, viewer }: { user: User; viewer: boolean }) {
  const [code, setCode] = useState(new URLSearchParams(location.search).get('code') ?? '');
  const [sid, setSid] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const online = useOnline();
  async function join() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await command<{ id: string }>('join', { code, viewer });
      setSid(result.id);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className={`live-shell ${viewer ? 'projector-view' : 'audience-view'}`}>
      <header>
        <h1>Пульсар</h1>
        <p>{viewer ? 'Экран аудитории' : 'Участие во встрече'}</p>
      </header>
      {!online && (
        <p className="notice" role="status">
          Нет соединения. Показанные данные могут быть устаревшими.
        </p>
      )}
      {!sid ? (
        <form
          className="card entry-form"
          onSubmit={(e) => {
            e.preventDefault();
            void join();
          }}
        >
          <h2>{viewer ? 'Открыть проектор' : 'Подключиться к встрече'}</h2>
          <label>
            Код встречи
            <input
              autoComplete="off"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s/g, ''))}
              maxLength={30}
            />
          </label>
          <button disabled={busy || !online || !code.trim()}>
            {busy ? 'Подключаемся…' : 'Войти'}
          </button>
          <p role="alert">{error}</p>
          <p>
            Имя не требуется и не показывается. Ведущий видит ответы и может сопоставить ответы
            одного участника внутри встречи. Данные хранятся до удаления встречи ведущим.
          </p>
          <p>
            После обновления страницы войдите по тому же коду — ответы сохранятся в этом браузере.
          </p>
        </form>
      ) : (
        <Connected
          sessionId={sid}
          uid={user.uid}
          viewer={viewer}
          joinCode={code}
          onLeave={() => setSid(null)}
        />
      )}
    </main>
  );
}
function Connected({
  sessionId,
  uid,
  viewer,
  joinCode,
  onLeave,
}: {
  sessionId: string;
  uid: string;
  viewer: boolean;
  joinCode: string;
  onLeave: () => void;
}) {
  const room = useLiveDoc<Room>(`rooms/${sessionId}`);
  const round = room.data?.round;
  const path = round ? `meetings/${sessionId}/rounds/${round.id}` : null;
  const own = useLiveDoc<OwnAnswers>(!viewer && path ? `${path}/private/${uid}` : null);
  const published = useLiveList<PublicResponse>(
    round?.visible && path ? `${path}/published` : null,
  );
  const likes = useLiveList<{ responseId: string; enabled: boolean; revision: number }>(
    !viewer && round?.likesOpen && path ? `${path}/likes` : null,
    'uid',
    uid,
  );
  const [error, setError] = useState('');
  const [liking, setLiking] = useState<string | null>(null);
  if (room.error || (room.loaded && !room.data))
    return (
      <section className="card">
        <p role="alert">{room.error || 'Встреча удалена или недоступна.'}</p>
        <button onClick={onLeave}>Ввести другой код</button>
      </section>
    );
  if (!room.data) return <p>Подключаемся к встрече…</p>;
  const data = room.data;
  if (data.status === 'finished' || data.status === 'deleting')
    return (
      <section className="card">
        <h2>{data.title}</h2>
        <p>Встреча завершена. Спасибо за участие.</p>
        <button onClick={onLeave}>Другая встреча</button>
      </section>
    );
  if (!round)
    return (
      <section className="card">
        <h2>{data.title}</h2>
        <p>Ожидаем первый вопрос ведущего.</p>
        {viewer && (
          <div className="join-corner waiting">
            <JoinQr url={`${location.origin}/participant?code=${joinCode}`} />
            <p>
              Код для входа: <strong>{joinCode}</strong>
            </p>
          </div>
        )}
      </section>
    );
  if (viewer)
    return (
      <>
        <h2>{data.title}</h2>
        <p className="join-corner">
          Код: <strong>{joinCode}</strong>
        </p>
        {data.frozen ? (
          <LiveResults round={data.frozen.round} results={data.frozen.results} />
        ) : published.error ? (
          <p role="alert">{published.error}</p>
        ) : (
          <LiveResults round={round} results={published.data} />
        )}
      </>
    );
  async function toggle(response: PublicResponse, enabled: boolean) {
    setLiking(response.id);
    setError('');
    try {
      await command('like', { sessionId, roundId: round!.id, responseId: response.id, enabled });
    } catch (e) {
      setError(message(e));
    } finally {
      setLiking(null);
    }
  }
  return (
    <>
      <h2>{data.title}</h2>
      {own.error ? (
        <p role="alert">{own.error}</p>
      ) : !own.loaded ? (
        <p>Загружаем ваши ответы…</p>
      ) : (
        <ResponseForm
          key={round.id}
          sessionId={sessionId}
          uid={uid}
          round={round}
          own={Object.values(own.data?.answers ?? {})}
        />
      )}
      {round.visible && (
        <>
          <LiveResults round={round} results={published.data} />
          {published.error && <p role="alert">{published.error}</p>}
        </>
      )}
      {round.likesOpen && (
        <section className="card">
          <h2>Выберите полезные идеи</h2>
          {published.data.map((r) => {
            const enabled = likes.data.some(
              (l) => l.responseId === r.id && l.enabled && l.revision === r.revision,
            );
            return (
              <article key={r.id}>
                <p>{r.value}</p>
                <button disabled={liking !== null} onClick={() => void toggle(r, !enabled)}>
                  {enabled ? 'Снять лайк' : 'Поставить лайк'} ({r.likes})
                </button>
              </article>
            );
          })}
          <p role="alert">{error || likes.error}</p>
        </section>
      )}
    </>
  );
}
