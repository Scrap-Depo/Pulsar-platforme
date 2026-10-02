import { useEffect, useRef, useState } from 'react';
import { signOut, User } from 'firebase/auth';
import { auth } from '../shared/lib/firebase';
import { command, download, message } from '../shared/lib/liveApi';
import { useLiveDoc, useLiveList, useOnline } from '../shared/hooks/useLiveData';
import {
  Meeting,
  PublicResponse,
  Response,
  Room,
  Round,
  RoundSettings,
} from '../shared/types/live';
import { SessionSlide, SlideType } from '../shared/types/common';
import {
  createSlide,
  createTemplateSlide,
  defaultSession,
  duplicateSlide,
  moveSlide,
  slideTemplates,
} from '../shared/lib/session';
import LiveResults from './LiveResults';
import JoinQr from '../shared/ui/JoinQr';

export default function MeetingAdmin({ user }: { user: User }) {
  const list = useLiveList<Meeting>('meetings', 'ownerUid', user.uid);
  const [id, setId] = useState(new URLSearchParams(location.search).get('session'));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const createRequest = useRef(crypto.randomUUID());
  function select(sid: string | null) {
    setId(sid);
    history.replaceState(null, '', sid ? `/?session=${sid}` : '/');
  }
  async function create() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const next = await command<{ id: string }>('create', {
        requestId: createRequest.current,
        title: 'Новая встреча',
        slides: defaultSession.slides,
      });
      createRequest.current = crypto.randomUUID();
      select(next.id);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="live-shell host-view">
      <header className="host-header">
        <div>
          <h1>Пульсар</h1>
          <p>Встречи до 100 участников</p>
        </div>
        <button
          onClick={() => {
            void signOut(auth);
          }}
        >
          Выйти ({user.email})
        </button>
      </header>
      {id ? (
        <HostSession key={id} id={id} onBack={() => select(null)} />
      ) : (
        <section className="card">
          <h2>Мои встречи</h2>
          <button disabled={busy} onClick={() => void create()}>
            {busy ? 'Создаём…' : 'Новая встреча'}
          </button>
          <p role="alert">{error || list.error}</p>
          {!list.loaded && <p>Загружаем встречи…</p>}
          <div className="meeting-list">
            {[...list.data]
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
              .map((m) => (
                <button key={m.id} onClick={() => select(m.id)}>
                  {m.title} —{' '}
                  {m.status === 'finished'
                    ? 'завершена'
                    : m.status === 'deleting'
                      ? 'удаление не завершено'
                      : m.status === 'live'
                        ? 'в эфире'
                        : 'подготовка'}
                </button>
              ))}
          </div>
          <p>
            Ответы хранятся до удаления встречи. Старые встречи из первой версии не
            перезаписываются.
          </p>
        </section>
      )}
    </main>
  );
}
function HostSession({ id, onBack }: { id: string; onBack: () => void }) {
  const meeting = useLiveDoc<Meeting>(`meetings/${id}`),
    room = useLiveDoc<Room>(`rooms/${id}`);
  const rounds = useLiveList<Round>(`meetings/${id}/rounds`);
  const rid = meeting.data?.roundId;
  const responses = useLiveList<Response>(rid ? `meetings/${id}/rounds/${rid}/responses` : null);
  const published = useLiveList<PublicResponse>(
    rid && room.data?.round?.visible ? `meetings/${id}/rounds/${rid}/published` : null,
  );
  const [draft, setDraft] = useState<Meeting | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [config, setConfig] = useState<RoundSettings>({
    cardLimit: 1,
    moderation: true,
    immediate: false,
  });
  const [deleteText, setDeleteText] = useState('');
  const [historyId, setHistoryId] = useState('');
  const [openRequest, setOpenRequest] = useState<string | null>(null);
  const online = useOnline();
  useEffect(() => {
    if (meeting.data && !dirty)
      setDraft((previous) => ({
        ...meeting.data!,
        currentSlideId:
          previous && meeting.data!.slides.some((s) => s.id === previous.currentSlideId)
            ? previous.currentSlideId
            : meeting.data!.currentSlideId,
      }));
  }, [meeting.data, dirty]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  async function run(action: string, params: Record<string, unknown> = {}) {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await command(action, { sessionId: id, ...params });
      if (action === 'export') download(result, `pulsar-${id}.json`);
      if (action === 'delete') {
        removeDrafts(id);
        onBack();
      }
      if (action === 'save') setDirty(false);
      if (action === 'open') setOpenRequest(null);
      setNotice('Изменение сохранено.');
      return true;
    } catch (e) {
      setError(message(e));
      return false;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  if (meeting.error || (meeting.loaded && !meeting.data))
    return (
      <section className="card">
        <p role="alert">{meeting.error || 'Встреча удалена или недоступна.'}</p>
        <button onClick={onBack}>К списку встреч</button>
      </section>
    );
  if (!draft || !meeting.data) return <p>Загружаем встречу…</p>;
  const m = meeting.data,
    current = draft.slides.find((s) => s.id === draft.currentSlideId) ?? draft.slides[0];
  const round = room.data?.round;
  const finished = ['finished', 'deleting'].includes(m.status);
  const joined = room.data?.joinedCount ?? 0;
  const answered = new Set(responses.data.map((r) => r.participantId)).size;
  const joinLink = `${location.origin}/participant?code=${m.joinCode}`;
  const projectorLink = `${location.origin}/projector?code=${m.joinCode}`;
  function patch(patch: Partial<Meeting>) {
    setDraft((d) => (d ? { ...d, ...patch } : d));
    setDirty(true);
  }
  function slideChange(slide: SessionSlide) {
    patch({ slides: draft!.slides.map((s) => (s.id === slide.id ? slide : s)) });
  }
  function add(type: SlideType, template?: string) {
    const slide = template
      ? createTemplateSlide(template, draft!.slides.length)
      : createSlide(type, draft!.slides.length);
    slide.id = `slide-${crypto.randomUUID()}`;
    if (!slide.title) slide.title = 'Новый вопрос';
    patch({ slides: [...draft!.slides, slide], currentSlideId: slide.id });
  }
  function open() {
    const requestId = openRequest ?? crypto.randomUUID();
    setOpenRequest(requestId);
    void run('open', { slideId: current.id, settings: config, requestId });
  }
  return (
    <div className="section-stack">
      <div className="button-row">
        <button
          onClick={() => {
            if (!dirty || window.confirm('Есть несохранённые изменения. Выйти без сохранения?'))
              onBack();
          }}
        >
          Мои встречи
        </button>
        <a href={joinLink} target="_blank" rel="noreferrer">
          Вход участника
        </a>
        <a href={projectorLink} target="_blank" rel="noreferrer">
          Открыть проектор
        </a>
      </div>
      {!online && (
        <p className="notice" role="status">
          Нет соединения. Управление встречей недоступно.
        </p>
      )}
      <p role="alert">
        {error || room.error || responses.error || rounds.error || published.error}
      </p>
      <p role="status">{busy ? 'Сохраняем…' : notice}</p>
      <section className="card control-panel">
        <h2>{m.title}</h2>
        <p>
          Код: <strong>{m.joinCode}</strong>
        </p>
        <p className="join-url">{joinLink}</p>
        <JoinQr url={joinLink} />
        <button
          onClick={() => {
            navigator.clipboard
              .writeText(joinLink)
              .then(() => setNotice('Ссылка скопирована.'))
              .catch(() => setError('Не удалось скопировать. Выделите ссылку выше.'));
          }}
        >
          Скопировать ссылку
        </button>
        <p>
          Присоединились: {joined}/100. Ответили на текущий вопрос: {answered}. Карточек:{' '}
          {responses.data.length}.
        </p>
        <p>
          {finished
            ? 'Встреча завершена'
            : round
              ? `${round.slide.title} — ${round.phase === 'open' ? 'приём открыт' : 'приём закрыт'}; результаты ${round.visible ? 'открыты' : 'скрыты'}`
              : 'Ожидает первого вопроса'}
        </p>
        <fieldset disabled={busy || !online || finished} className="button-row">
          <legend className="sr-only">Управление эфиром</legend>
          <button disabled={!round || round.phase !== 'open'} onClick={() => void run('close')}>
            Закрыть приём
          </button>
          <button
            disabled={!round || round.phase !== 'closed' || round.visible}
            onClick={() => void run('reveal')}
          >
            Открыть результаты
          </button>
          <button
            disabled={!round}
            onClick={() => void run('freeze', { enabled: !room.data?.frozen })}
          >
            {room.data?.frozen ? 'Снять заморозку' : 'Заморозить проектор'}
          </button>
          <button
            disabled={
              !round?.visible || round.phase !== 'closed' || round.slide.type !== 'open-answers'
            }
            onClick={() => void run('likes', { enabled: !round?.likesOpen })}
          >
            {round?.likesOpen ? 'Закрыть лайки' : 'Открыть лайки'}
          </button>
          <button
            onClick={() => {
              if (window.confirm('Завершить встречу? Приём ответов и лайков прекратится.'))
                void run('finish');
            }}
          >
            Завершить встречу
          </button>
        </fieldset>
        {round && (
          <Timer
            round={round}
            disabled={busy || finished || !online}
            onSet={(seconds) => void run('timer', { seconds })}
          />
        )}
        {room.data?.frozen && (
          <p>
            Проектор сохраняет последний снимок. Приём ответов управляется отдельно. Скрытие
            карточки снимает заморозку, чтобы убрать её с экрана.
          </p>
        )}
      </section>
      {!finished && (
        <div className="host-workspace">
          <aside className="card slide-list">
            <h2>Слайды</h2>
            {draft.slides.map((s, i) => (
              <div key={s.id}>
                <button
                  aria-pressed={s.id === current.id}
                  onClick={() => setDraft((d) => (d ? { ...d, currentSlideId: s.id } : d))}
                >
                  {i + 1}. {s.title || 'Новый вопрос'}
                </button>
                <div className="button-row">
                  <button
                    aria-label={`Поднять слайд ${i + 1}`}
                    disabled={i === 0}
                    onClick={() => patch({ slides: moveSlide(draft.slides, s.id, 'up') })}
                  >
                    Выше
                  </button>
                  <button
                    aria-label={`Опустить слайд ${i + 1}`}
                    disabled={i === draft.slides.length - 1}
                    onClick={() => patch({ slides: moveSlide(draft.slides, s.id, 'down') })}
                  >
                    Ниже
                  </button>
                  <button onClick={() => patch({ slides: duplicateSlide(draft.slides, s.id) })}>
                    Копия
                  </button>
                  <button
                    disabled={draft.slides.length === 1}
                    onClick={() =>
                      patch({
                        slides: draft.slides.filter((x) => x.id !== s.id),
                        currentSlideId: draft.slides.find((x) => x.id !== s.id)!.id,
                      })
                    }
                  >
                    Удалить слайд
                  </button>
                </div>
              </div>
            ))}
            <label>
              Добавить вопрос
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) add(e.target.value as SlideType);
                }}
              >
                <option value="">Выберите тип</option>
                <option value="multiple-choice">Голосование</option>
                <option value="open-answers">Открытые ответы</option>
                <option value="pulse">Шкала</option>
                <option value="word-cloud">Облако слов</option>
              </select>
            </label>
            <label>
              Готовое упражнение
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) add('multiple-choice', e.target.value);
                }}
              >
                <option value="">Выберите шаблон</option>
                {slideTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
          </aside>
          <section className="card section-stack">
            <h2>Редактор следующего раунда</h2>
            <p>
              Вопрос в эфире сохраняет свою формулировку. Изменения применятся при запуске нового
              раунда.
            </p>
            <fieldset disabled={busy}>
              <legend className="sr-only">Редактор</legend>
              <label>
                Название встречи
                <input
                  value={draft.title}
                  maxLength={150}
                  onChange={(e) => patch({ title: e.target.value })}
                />
              </label>
              <SlideEditor slide={current} onChange={slideChange} />
            </fieldset>
            <div className="button-row">
              <button
                disabled={busy || !online || !dirty}
                onClick={() =>
                  void run('save', {
                    slides: draft.slides,
                    title: draft.title,
                    currentSlideId: draft.currentSlideId,
                    version: draft.version,
                  })
                }
              >
                Сохранить редактор
              </button>
              {dirty && (
                <button
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm('Отменить несохранённые изменения?')) {
                      setDirty(false);
                      setDraft(m);
                    }
                  }}
                >
                  Отменить изменения
                </button>
              )}
            </div>
            {dirty && <p>Есть несохранённые изменения.</p>}
            <fieldset disabled={busy}>
              <legend>Настройки нового раунда</legend>
              <label>
                Карточек на участника
                <select
                  value={config.cardLimit}
                  onChange={(e) =>
                    setConfig({ ...config, cardLimit: Number(e.target.value) as 1 | 3 })
                  }
                >
                  <option value={1}>1</option>
                  <option value={3}>3 — для открытых ответов</option>
                </select>
              </label>
              <label className="choice">
                <input
                  type="checkbox"
                  checked={config.moderation}
                  onChange={(e) => setConfig({ ...config, moderation: e.target.checked })}
                />
                Одобрять свободный текст перед публикацией
              </label>
              <label className="choice">
                <input
                  type="checkbox"
                  checked={config.immediate}
                  onChange={(e) => setConfig({ ...config, immediate: e.target.checked })}
                />
                Показывать результаты сразу при сборе
              </label>
            </fieldset>
            <button disabled={busy || !online || dirty} onClick={open}>
              {openRequest ? 'Повторить запуск раунда' : 'Открыть новый раунд'}
            </button>
            <p>
              Новый раунд закрывает предыдущий и начинает сбор с нуля. Прежние ответы остаются в
              истории.
            </p>
            <button
              disabled={busy || dirty || !round || !online}
              onClick={() => void run('appearance')}
            >
              Применить только оформление к эфиру
            </button>
          </section>
        </div>
      )}
      {round && !finished && (
        <Moderation
          responses={responses.data}
          busy={busy || !online}
          onAction={(params) =>
            void run('moderate', {
              ...params,
              revisions: Object.fromEntries(responses.data.map((r) => [r.id, r.revision])),
            })
          }
        />
      )}
      {round && (
        <section className="card">
          <h2>Предпросмотр проектора</h2>
          <LiveResults
            round={room.data?.frozen?.round ?? round}
            results={room.data?.frozen?.results ?? published.data}
          />
        </section>
      )}
      <section className="card">
        <h2>История и данные</h2>
        <label>
          Раунд
          <select value={historyId} onChange={(e) => setHistoryId(e.target.value)}>
            <option value="">Выберите раунд</option>
            {[...rounds.data]
              .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
              .map((r) => (
                <option value={r.id} key={r.id}>
                  {r.slide.title} (
                  {r.createdAt ? new Date(r.createdAt).toLocaleString('ru-RU') : r.id})
                </option>
              ))}
          </select>
        </label>
        {historyId && (
          <RoundHistory sessionId={id} round={rounds.data.find((r) => r.id === historyId)!} />
        )}
        <p>Данные хранятся до удаления ведущим. Выгрузка доступна после завершения встречи.</p>
        <button
          disabled={busy || m.status !== 'finished' || !online}
          onClick={() => void run('export')}
        >
          Скачать результаты JSON
        </button>
        <details>
          <summary>Удалить встречу и все ответы</summary>
          <p>
            Удаление необратимо. Сначала скачайте результаты, если они нужны. Для подтверждения
            введите код {m.joinCode}.
          </p>
          <input
            aria-label="Код для удаления"
            value={deleteText}
            onChange={(e) => setDeleteText(e.target.value)}
          />
          <button
            disabled={busy || !online || deleteText !== m.joinCode}
            onClick={() => void run('delete')}
          >
            {m.status === 'deleting' ? 'Повторить удаление' : 'Удалить встречу'}
          </button>
        </details>
      </section>
    </div>
  );
}
function SlideEditor({
  slide,
  onChange,
}: {
  slide: SessionSlide;
  onChange: (slide: SessionSlide) => void;
}) {
  const patch = (data: Record<string, unknown>) => onChange({ ...slide, ...data } as SessionSlide);
  const choices =
    slide.type === 'multiple-choice'
      ? ['bar', 'pie', 'donut']
      : slide.type === 'pulse'
        ? ['bars', 'line', 'scale']
        : slide.type === 'word-cloud'
          ? ['cloud', 'bubbles', 'constellation']
          : ['cards'];
  const labels: Record<string, string> = {
    bar: 'Столбцы',
    bars: 'Столбцы',
    pie: 'Круг',
    donut: 'Кольцо',
    line: 'Линия распределения',
    scale: 'Среднее на шкале',
    cloud: 'Облако',
    bubbles: 'Пузыри',
    constellation: 'Сетка слов',
    cards: 'Карточки',
  };
  return (
    <div className="section-stack">
      <label>
        Вопрос
        <textarea
          rows={3}
          maxLength={300}
          value={slide.title}
          onChange={(e) => patch({ title: e.target.value })}
        />
      </label>
      {slide.type === 'multiple-choice' && (
        <>
          {slide.options.map((o, i) => (
            <div className="option-editor" key={o.id}>
              <label>
                Вариант {i + 1}
                <input
                  maxLength={120}
                  value={o.text}
                  onChange={(e) =>
                    patch({
                      options: slide.options.map((x) =>
                        x.id === o.id ? { ...x, text: e.target.value } : x,
                      ),
                    })
                  }
                />
              </label>
              <button
                disabled={slide.options.length <= 2}
                onClick={() => patch({ options: slide.options.filter((x) => x.id !== o.id) })}
              >
                Убрать
              </button>
            </div>
          ))}
          <button
            disabled={slide.options.length >= 10}
            onClick={() =>
              patch({
                options: [
                  ...slide.options,
                  { id: Date.now(), text: 'Новый вариант', votes: 0, color: '#479ddb' },
                ],
              })
            }
          >
            Добавить вариант
          </button>
          <label>
            Подписи результатов
            <select
              value={slide.resultDisplay}
              onChange={(e) => patch({ resultDisplay: e.target.value })}
            >
              <option value="both">Голоса и проценты</option>
              <option value="votes">Голоса</option>
              <option value="percent">Проценты</option>
            </select>
          </label>
        </>
      )}
      {slide.type === 'pulse' && (
        <>
          <label>
            Подпись оценки 1
            <input
              maxLength={60}
              value={slide.minLabel}
              onChange={(e) => patch({ minLabel: e.target.value })}
            />
          </label>
          <label>
            Подпись оценки 10
            <input
              maxLength={60}
              value={slide.maxLabel}
              onChange={(e) => patch({ maxLabel: e.target.value })}
            />
          </label>
        </>
      )}
      {slide.type === 'word-cloud' && (
        <label className="choice">
          <input
            type="checkbox"
            checked={slide.useAI}
            onChange={(e) => patch({ useAI: e.target.checked })}
          />
          Убирать лишние пробелы и пунктуацию
        </label>
      )}
      <label>
        Вид результата
        <select
          value={slide.visualization}
          onChange={(e) => patch({ visualization: e.target.value })}
        >
          {choices.map((c) => (
            <option key={c} value={c}>
              {labels[c]}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
function Moderation({
  responses,
  busy,
  onAction,
}: {
  responses: Response[];
  busy: boolean;
  onAction: (params: Record<string, unknown>) => void;
}) {
  const texts = responses.filter((r) => ['open-answers', 'word-cloud'].includes(r.type));
  const [selected, setSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState<{ id: string; text: string; revision: number } | null>(
    null,
  );
  if (!texts.length) return null;
  return (
    <section className="card moderation">
      <h2>Модерация ответов</h2>
      <p>
        Ожидают: {texts.filter((r) => r.moderation === 'pending').length}. Скрыты:{' '}
        {texts.filter((r) => r.moderation === 'hidden').length}.
      </p>
      <button
        disabled={busy || !selected.length}
        onClick={() => {
          onAction({ ids: selected.slice(0, 100), status: 'approved' });
          setSelected([]);
        }}
      >
        Одобрить выбранные (до 100)
      </button>
      <div className="answer-grid">
        {texts.map((r) => (
          <article className="card" key={r.id}>
            <label className="choice">
              <input
                type="checkbox"
                checked={selected.includes(r.id)}
                onChange={(e) =>
                  setSelected((ids) =>
                    e.target.checked ? [...ids, r.id] : ids.filter((id) => id !== r.id),
                  )
                }
              />
              {r.moderation === 'pending'
                ? 'На проверке'
                : r.moderation === 'approved'
                  ? 'Одобрено'
                  : 'Скрыто'}
            </label>
            <p>{r.displayValue ?? r.value}</p>
            {r.displayValue && (
              <details>
                <summary>Оригинал участника</summary>
                <p>{r.value}</p>
              </details>
            )}
            <div className="button-row">
              <button
                disabled={busy}
                onClick={() =>
                  onAction({
                    ids: [r.id],
                    status: r.moderation === 'approved' ? 'hidden' : 'approved',
                  })
                }
              >
                {r.moderation === 'approved' ? 'Скрыть' : 'Одобрить'}
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  setEditing({
                    id: r.id,
                    text: String(r.displayValue ?? r.value),
                    revision: r.revision,
                  })
                }
              >
                Редактировать с пометкой
              </button>
            </div>
            {editing?.id === r.id && (
              <>
                <textarea
                  aria-label="Редакция ведущего"
                  value={editing.text}
                  onChange={(e) => setEditing({ ...editing, text: e.target.value })}
                />
                <button
                  disabled={busy || !editing.text.trim()}
                  onClick={() => {
                    onAction({
                      ids: [r.id],
                      status: 'approved',
                      displayValue: editing.text,
                      revision: editing.revision,
                    });
                    setEditing(null);
                  }}
                >
                  Сохранить редакцию
                </button>
                <button onClick={() => setEditing(null)}>Отмена</button>
              </>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
function Timer({
  round,
  disabled,
  onSet,
}: {
  round: Round;
  disabled: boolean;
  onSet: (seconds: number) => void;
}) {
  const [now, setNow] = useState(Date.now());
  const [seconds, setSeconds] = useState(60);
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const remaining = round.deadline
    ? Math.max(0, Math.ceil((Date.parse(round.deadline) - now) / 1000))
    : null;
  return (
    <div className="timer">
      <label>
        Таймер, секунд
        <input
          type="number"
          min={1}
          max={3600}
          value={seconds}
          onChange={(e) => setSeconds(Number(e.target.value))}
        />
      </label>
      <button disabled={disabled || round.phase !== 'open'} onClick={() => onSet(seconds)}>
        Запустить таймер
      </button>
      {remaining !== null && (
        <>
          <p role="status">
            {remaining
              ? `Осталось ${remaining} с`
              : 'Время истекло. Приём ответов остаётся открытым до команды ведущего.'}
          </p>
          <button disabled={disabled || round.phase !== 'open'} onClick={() => onSet(0)}>
            Убрать таймер
          </button>
        </>
      )}
    </div>
  );
}
function RoundHistory({ sessionId, round }: { sessionId: string; round?: Round }) {
  const responses = useLiveList<Response>(
    round ? `meetings/${sessionId}/rounds/${round.id}/responses` : null,
  );
  if (!round) return null;
  return (
    <div>
      <h3>{round.slide.title}</h3>
      <p>
        Ответили: {new Set(responses.data.map((r) => r.participantId)).size}. Ответов:{' '}
        {responses.data.length}.
      </p>
      <p role="alert">{responses.error}</p>
      <details>
        <summary>Все ответы (видны только ведущему)</summary>
        {responses.data.map((r) => (
          <p key={r.id}>
            {round.slide.type === 'multiple-choice'
              ? round.slide.options.find((o) => o.id === r.value)?.text
              : r.value}{' '}
            {r.displayValue ? `— редакция: ${r.displayValue}` : ''}
          </p>
        ))}
      </details>
    </div>
  );
}
function removeDrafts(sessionId: string) {
  try {
    Object.keys(localStorage)
      .filter((key) => key.startsWith('pulsar.draft.v2:') && key.includes(`:${sessionId}:`))
      .forEach((key) => localStorage.removeItem(key));
  } catch {
    /* Remote data is already deleted. */
  }
}
