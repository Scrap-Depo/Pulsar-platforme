import { useState } from 'react';
import { OwnResponse, Round } from '../shared/types/live';
import { command, message } from '../shared/lib/liveApi';
import { useOnline } from '../shared/hooks/useLiveData';

type Pending = { requestId: string; value: string | number; revision: number };
export default function ResponseForm({
  sessionId,
  uid,
  round,
  own,
}: {
  sessionId: string;
  uid: string;
  round: Round;
  own: OwnResponse[];
}) {
  const [slot, setSlot] = useState(0);
  const count = round.slide.type === 'open-answers' ? round.settings.cardLimit : 1;
  return (
    <section className="card response-form">
      <h2>{round.slide.title}</h2>
      {count > 1 && (
        <div className="button-row" role="group" aria-label="Карточки">
          {Array.from({ length: count }, (_, i) => (
            <button key={i} type="button" aria-pressed={slot === i} onClick={() => setSlot(i)}>
              Карточка {i + 1}
              {own.some((r) => r.slot === i) ? ' — сохранена' : ''}
            </button>
          ))}
        </div>
      )}
      <SlotForm
        key={`${sessionId}:${round.id}:${slot}`}
        sessionId={sessionId}
        uid={uid}
        round={round}
        slot={slot}
        saved={own.find((r) => r.slot === slot)}
      />
    </section>
  );
}
function SlotForm({
  sessionId,
  uid,
  round,
  slot,
  saved,
}: {
  sessionId: string;
  uid: string;
  round: Round;
  slot: number;
  saved?: OwnResponse;
}) {
  const key = `pulsar.draft.v2:${uid}:${sessionId}:${round.id}:${slot}`;
  const [initial] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(key) || 'null') as {
        value: string | number;
        pending?: Pending;
        revision?: number;
      } | null;
    } catch {
      return null;
    }
  });
  const [value, setValue] = useState<string | number>(initial?.value ?? saved?.value ?? '');
  const [pending, setPending] = useState<Pending | undefined>(initial?.pending);
  const [revision, setRevision] = useState(
    initial?.pending?.requestId === saved?.requestId && saved
      ? saved.revision
      : (initial?.revision ?? saved?.revision ?? 0),
  );
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [storageError, setStorageError] = useState('');
  const online = useOnline();
  const limit = round.slide.type === 'word-cloud' ? 40 : 300;
  const numeric = ['multiple-choice', 'pulse'].includes(round.slide.type);
  const valid = numeric
    ? typeof value === 'number'
    : !!String(value).trim() && [...String(value).trim()].length <= limit;
  const accepted = pending && saved?.requestId === pending.requestId;
  function persist(next: string | number, attempt?: Pending, base = revision) {
    try {
      localStorage.setItem(key, JSON.stringify({ value: next, pending: attempt, revision: base }));
      setStorageError('');
    } catch {
      setStorageError('Браузер не сохраняет черновик. Не закрывайте страницу до отправки.');
    }
  }
  function change(next: string | number) {
    setValue(next);
    setPending(undefined);
    setFeedback('');
    persist(next);
  }
  async function submit() {
    if (busy || !valid) return;
    const attempt =
      pending && pending.value === value
        ? pending
        : { requestId: crypto.randomUUID(), value, revision };
    setPending(attempt);
    persist(value, attempt);
    setBusy(true);
    setFeedback('');
    try {
      const result = await command<{ revision: number }>('submit', {
        sessionId,
        roundId: round.id,
        slot,
        ...attempt,
      });
      setRevision(result.revision);
      persist(value, attempt, result.revision);
      setFeedback('Ответ принят.');
      // Keep the stable attempt ID until the user changes the draft. Retrying
      // after an ambiguous timeout or a reload cannot create another card.
    } catch (error) {
      setFeedback(message(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="section-stack">
      <fieldset disabled={busy || round.phase !== 'open'}>
        <legend className="sr-only">Ваш ответ</legend>
        {round.slide.type === 'multiple-choice' ? (
          <div className="section-stack">
            {round.slide.options.map((option) => (
              <label className="choice card" key={option.id}>
                <input
                  type="radio"
                  name={`answer-${round.id}`}
                  checked={value === option.id}
                  onChange={() => change(option.id)}
                />
                {option.text}
              </label>
            ))}
          </div>
        ) : round.slide.type === 'pulse' ? (
          <>
            <p>
              {round.slide.minLabel} — {round.slide.maxLabel}
            </p>
            <div className="pulse-buttons">
              {Array.from({ length: 10 }, (_, i) => (
                <button
                  type="button"
                  key={i}
                  aria-pressed={value === i + 1}
                  onClick={() => change(i + 1)}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <p>{value === '' ? 'Выберите оценку от 1 до 10' : `Выбрано: ${value}`}</p>
          </>
        ) : (
          <label>
            Ваш ответ
            <textarea
              aria-label="Ваш ответ"
              rows={round.slide.type === 'word-cloud' ? 2 : 4}
              value={String(value)}
              onChange={(e) => change(e.target.value)}
            />
            <small>
              {[...String(value)].length}/{limit} символов
            </small>
          </label>
        )}
      </fieldset>
      {round.phase === 'open' ? (
        <button type="button" disabled={busy || !online || !valid} onClick={submit}>
          {busy
            ? 'Отправляется…'
            : saved
              ? 'Сохранить изменение'
              : pending
                ? 'Повторить отправку'
                : 'Отправить'}
        </button>
      ) : (
        <p>Приём ответов закрыт. Черновик сохранён на этом устройстве.</p>
      )}
      {!online && <p role="status">Нет соединения. Черновик остаётся на устройстве.</p>}
      <p role="status" aria-live="polite">
        {feedback ||
          (accepted ? 'Ответ принят.' : saved ? 'Ранее отправленный ответ сохранён.' : '')}
      </p>
      {saved && (
        <div className="saved-answer">
          <small>Сохранено:</small>
          <p>
            {round.slide.type === 'multiple-choice'
              ? round.slide.options.find((o) => o.id === saved.value)?.text
              : saved.value}
          </p>
          {saved.moderation === 'pending' && <small>Ожидает одобрения перед публикацией.</small>}
          {saved.displayValue && <p>Редакция ведущего: {saved.displayValue}</p>}
        </div>
      )}
      {saved && saved.revision !== revision && !accepted && !busy && (
        <div>
          <p>Ответ изменён в другой вкладке. Ваш черновик не перезаписан.</p>
          <button
            type="button"
            onClick={() => {
              setValue(saved.value);
              setRevision(saved.revision);
              setPending(undefined);
              setFeedback('');
              persist(saved.value, undefined, saved.revision);
            }}
          >
            Загрузить сохранённый ответ
          </button>
        </div>
      )}
      {storageError && <p role="alert">{storageError}</p>}
    </div>
  );
}
