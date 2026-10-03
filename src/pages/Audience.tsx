import { useEffect, useRef, useState } from 'react';
import { User } from 'firebase/auth';
import LikeIcon from '../shared/ui/LikeIcon';
import LikeCount from '../shared/ui/LikeCount';
import { Room, PublicResponse, OwnAnswers } from '../shared/types/live';
import { useLiveDoc, useLiveList, useOnline } from '../shared/hooks/useLiveData';
import { command, message } from '../shared/lib/liveApi';
import ResponseForm from './ResponseForm';
import LiveResults from './LiveResults';
import JoinQr from '../shared/ui/JoinQr';
import LiveLikeReaction from './LiveLikeReaction';
export default function Audience({ user, viewer }: { user: User; viewer: boolean }) {
  const [code, setCode] = useState(new URLSearchParams(location.search).get('code') ?? '');
  const [editingCode, setEditingCode] = useState(!new URLSearchParams(location.search).get('code'));
  const [preview, setPreview] = useState<{ code: string; title?: string; error?: string } | null>(
    null,
  );
  const [sid, setSid] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const online = useOnline();
  const autoJoined = useRef(false);
  useEffect(() => {
    if (viewer || sid || !online || !code.trim()) return;
    let active = true;
    const timer = window.setTimeout(() => {
      void command<{ title: string }>('previewMeeting', { code })
        .then((result) => {
          if (active) setPreview({ code, title: result.title });
        })
        .catch((error) => {
          if (active) setPreview({ code, error: message(error) });
        });
    }, 350);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [code, viewer, sid, online]);
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
  useEffect(() => {
    // The projector opens straight into the meeting when the link carries a code.
    if (viewer && code && online && !autoJoined.current) {
      autoJoined.current = true;
      void join();
    }
  });
  return (
    <main className={`live-shell ${viewer ? 'projector-view' : 'audience-view'}`}>
      {!(viewer && sid) && (
        <header>
          <h1>
            <span className="pulse-dot" aria-hidden="true" />
            Пульсар
          </h1>
          <p>{viewer ? 'Экран аудитории' : 'Участие во встрече'}</p>
        </header>
      )}
      {viewer && sid && (
        <p className="projector-brand">
          <span className="pulse-dot" aria-hidden="true" />
          <span>
            <strong>Пульсар</strong> — платформа интерактивных опросов
          </span>
        </p>
      )}
      {!online && (
        <p className="notice" role="status">
          Нет соединения. Показанные данные могут быть устаревшими.
        </p>
      )}
      {viewer && sid && (
        <a className="back-to-host" href={`/?session=${sid}`}>
          ← К управлению
        </a>
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
          {!viewer && code && !editingCode ? (
            <div className="ready-code">
              <p>Код встречи</p>
              <p className="join-code">
                {code
                  .toUpperCase()
                  .replace(/\s/g, '')
                  .match(/.{1,3}/g)
                  ?.join(' ')}
              </p>
              <button type="button" className="text-action" onClick={() => setEditingCode(true)}>
                Другой код
              </button>
            </div>
          ) : (
            <label>
              Код встречи
              <input
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s/g, ''))}
                maxLength={30}
              />
            </label>
          )}
          {!viewer && code && (
            <p className="meeting-preview" role="status">
              {preview?.code === code
                ? preview.title || preview.error
                : 'Проверяем название встречи…'}
            </p>
          )}
          <button
            className="primary-action connect-action"
            disabled={busy || !online || !code.trim()}
          >
            {busy ? 'Подключаемся…' : viewer ? 'Открыть проектор' : 'Подключиться'}
          </button>
          {error && <p role="alert">{error}</p>}
          {!viewer && (
            <p className="entry-privacy">
              Имя не нужно. Данные хранятся до удаления встречи ведущим.
            </p>
          )}
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
    round?.visible &&
      path &&
      (viewer || round.settings.showOnPhones === true || round.slide.type === 'open-answers')
      ? `${path}/published`
      : null,
  );
  const likes = useLiveList<{ responseId: string; enabled: boolean; revision: number }>(
    !viewer && round?.likesOpen && path ? `${path}/likes` : null,
    'uid',
    uid,
  );
  const [error, setError] = useState('');
  const likeRequests = useRef(new Map<string, { desired: boolean }>());
  const [likeAcks, setLikeAcks] = useState<
    Record<string, { roundId: string; revision: number; enabled: boolean; pending: boolean }>
  >({});
  const [likeNotice, setLikeNotice] = useState<{
    roundId: string;
    responseId: string;
    enabled: boolean;
  } | null>(null);
  useEffect(() => {
    setLikeAcks((current) => {
      const next = { ...current };
      let changed = false;
      for (const [id, ack] of Object.entries(current)) {
        if (
          ack.roundId !== round?.id ||
          (!ack.pending &&
            likes.data.some(
              (like) =>
                like.responseId === id &&
                like.revision === ack.revision &&
                like.enabled === ack.enabled,
            ))
        ) {
          delete next[id];
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [round?.id, likes.data]);

  const [editingRound, setEditingRound] = useState<string | null>(null);
  const [startSlot, setStartSlot] = useState(0);
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
        <div className="projector-head">
          <div className="projector-title">
            <h2>{data.title}</h2>
            <p className={`live-indicator${round.phase === 'open' ? '' : ' paused'}`} role="status">
              {round.phase === 'open' ? 'Идёт сбор ответов' : 'Сбор ответов завершён'}
            </p>
          </div>
          <aside className="join-qr-corner">
            <JoinQr url={`${location.origin}/participant?code=${joinCode}`} />
            <p>
              Код: <strong>{joinCode}</strong>
            </p>
          </aside>
        </div>
        <LiveLikeReaction roundId={round.id} results={published.data} loaded={published.loaded} />
        {published.error ? (
          <p role="alert">{published.error}</p>
        ) : (
          <LiveResults round={round} results={published.data} />
        )}
      </>
    );
  async function toggle(response: PublicResponse, enabled: boolean) {
    const roundId = round!.id;
    const key = `${roundId}:${response.id}:${response.revision}`;
    const existing = likeRequests.current.get(key);
    const request = existing ?? { desired: enabled };
    if (existing) request.desired = !request.desired;
    setError('');
    setLikeAcks((current) => ({
      ...current,
      [response.id]: {
        roundId,
        revision: response.revision,
        enabled: request.desired,
        pending: true,
      },
    }));
    if (existing) return;
    likeRequests.current.set(key, request);
    try {
      while (true) {
        const desired = request.desired;
        await command('like', { sessionId, roundId, responseId: response.id, enabled: desired });
        // A tap during the request changes the desired state; send it next, in order.
        if (request.desired !== desired) continue;
        setLikeAcks((current) => ({
          ...current,
          [response.id]: { roundId, revision: response.revision, enabled: desired, pending: false },
        }));
        setLikeNotice({ roundId, responseId: response.id, enabled: desired });
        break;
      }
    } catch (e) {
      setLikeAcks((current) => {
        const next = { ...current };
        delete next[response.id];
        return next;
      });
      setError(message(e));
    } finally {
      likeRequests.current.delete(key);
    }
  }
  const ownAnswers = Object.values(own.data?.answers ?? {});
  const sentText = round.slide.type === 'open-answers' && ownAnswers.length > 0;
  const showForm = !sentText || editingRound === round.id;
  return (
    <>
      <h2>{data.title}</h2>
      {own.error ? (
        <p role="alert">{own.error}</p>
      ) : !own.loaded ? (
        <p>Загружаем ваши ответы…</p>
      ) : showForm ? (
        <ResponseForm
          key={round.id}
          sessionId={sessionId}
          uid={uid}
          round={round}
          own={ownAnswers}
          initialSlot={startSlot}
          onSent={() => setEditingRound(null)}
        />
      ) : (
        <section className="card sent-card">
          <svg className="sent-check" viewBox="0 0 52 52" aria-hidden="true">
            <circle cx="26" cy="26" r="24" />
            <path d="M15 27l8 8 14-16" />
          </svg>
          <p role="status">Ответ отправлен.</p>
          {ownAnswers.some((answer) => answer.moderation === 'pending') && (
            <p className="answer-meta">
              Ответ ожидает проверки ведущим и пока не показан остальным.
            </p>
          )}
          {round.settings.cardLimit > 1 && (
            <p className="sent-count">
              Карточек: {ownAnswers.length} из {round.settings.cardLimit}
            </p>
          )}
          {round.phase === 'open' && ownAnswers.length < round.settings.cardLimit && (
            <button
              className="primary-action"
              onClick={() => {
                const taken = new Set(ownAnswers.map((answer) => answer.slot));
                setStartSlot(
                  Array.from({ length: round.settings.cardLimit }, (_, i) => i).find(
                    (i) => !taken.has(i),
                  ) ?? 0,
                );
                setEditingRound(round.id);
              }}
            >
              Добавить ещё одну карточку
            </button>
          )}
          {round.phase === 'open' && (
            <button
              onClick={() => {
                setStartSlot(0);
                setEditingRound(round.id);
              }}
            >
              {round.settings.cardLimit > 1 ? 'Изменить мои карточки' : 'Изменить мой ответ'}
            </button>
          )}
        </section>
      )}
      {round.visible && round.settings.showOnPhones === true && !round.likesOpen && !sentText && (
        <>
          <LiveResults round={round} results={published.data} />
          {published.error && <p role="alert">{published.error}</p>}
        </>
      )}
      {sentText && !showForm && !round.likesOpen && <p>Выбор полезных идей пока закрыт ведущим.</p>}
      {round.visible && sentText && !showForm && (
        <section className="card participant-ideas" aria-label="Ответы участников">
          <h2>Ответы участников</h2>
          {round.likesOpen && <p>Отметьте полезные идеи других участников.</p>}
          {published.data.every((response) =>
            ownAnswers.some((answer) => answer.id === response.id),
          ) && <p>Другие ответы появятся здесь. Если включена модерация — после одобрения.</p>}
          {[...published.data]
            .sort((a, b) => b.likes - a.likes || a.id.localeCompare(b.id))
            .map((r) => {
              const ack = likeAcks[r.id];
              const enabled =
                ack?.roundId === round.id && ack.revision === r.revision
                  ? ack.enabled
                  : likes.data.some(
                      (l) => l.responseId === r.id && l.enabled && l.revision === r.revision,
                    );
              return (
                <article className="participant-idea" key={r.id}>
                  <p className="participant-answer-text">{r.value}</p>
                  {ownAnswers.some((answer) => answer.id === r.id) ? (
                    <div className="idea-footer">
                      <span className="answer-meta">Ваш ответ</span>
                      <LikeCount count={r.likes} label={`Ваш ответ · Лайков: ${r.likes}`} />
                    </div>
                  ) : (
                    <div className="idea-like-action">
                      <button
                        className="idea-like-button"
                        disabled={!round.likesOpen || !likes.loaded}
                        aria-label={`${enabled ? 'Снять лайк' : 'Поставить лайк'} (${r.likes})`}
                        title={
                          round.likesOpen
                            ? enabled
                              ? 'Снять лайк'
                              : 'Поставить лайк'
                            : 'Лайки закрыты ведущим'
                        }
                        aria-pressed={enabled}
                        onClick={() => void toggle(r, !enabled)}
                      >
                        <LikeIcon size={48} />
                        <span>{r.likes}</span>
                      </button>
                      {ack?.roundId === round.id && ack.revision === r.revision && ack.pending ? (
                        <p className="like-feedback" role="status">
                          {ack?.enabled ? 'Ставим лайк…' : 'Снимаем лайк…'}
                        </p>
                      ) : enabled ? (
                        <p className="like-feedback" role="status">
                          Лайк поставлен{round.likesOpen ? '. Нажмите ещё раз, чтобы снять.' : '.'}
                        </p>
                      ) : likeNotice?.roundId === round.id &&
                        likeNotice.responseId === r.id &&
                        !likeNotice.enabled ? (
                        <p className="like-feedback" role="status">
                          Лайк снят.
                        </p>
                      ) : null}
                    </div>
                  )}
                </article>
              );
            })}
          <p role="alert">{error || likes.error || published.error}</p>
        </section>
      )}
    </>
  );
}
