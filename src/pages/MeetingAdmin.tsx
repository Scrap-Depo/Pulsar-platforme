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
import QuestionPreview from './QuestionPreview';
import { ArrowDown, ArrowUp, BarChart3, Cloud, Copy, Gauge, MessageSquare, Trash2 } from 'lucide-react';
import Modal from '../shared/ui/Modal';
import JoinQr from '../shared/ui/JoinQr';

const slideIcons = {
  'multiple-choice': BarChart3,
  'open-answers': MessageSquare,
  pulse: Gauge,
  'word-cloud': Cloud,
} as const;
const slideTypes: [SlideType, string][] = [
  ['multiple-choice', 'Голосование'],
  ['open-answers', 'Открытые ответы'],
  ['pulse', 'Шкала'],
  ['word-cloud', 'Облако слов'],
];
type HostTab = 'prepare' | 'live' | 'results';
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
      const today = new Date();
      const next = await command<{ id: string }>('create', {
        requestId: createRequest.current,
        title: `Встреча ${today.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })} ${today.getFullYear()}`,
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
          {!id && <p>Встречи до 100 участников</p>}
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
    immediate: true,
  });
  const [deleteText, setDeleteText] = useState('');
  const [historyId, setHistoryId] = useState('');
  const [openRequest, setOpenRequest] = useState<string | null>(null);
  const [tab, setTab] = useState<HostTab | null>(null);
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
      const notices: Record<string, string> = {
        open: 'Вопрос запущен. Участники могут отвечать.',
        save: 'Вопросы и название встречи сохранены.',
        close: 'Сбор ответов завершён.',
        reveal: 'Результаты показаны участникам.',
        appearance: 'Вид результатов обновлён.',
        timer: 'Таймер обновлён.',
        finish: 'Встреча завершена.',
      };
      setNotice(notices[action] ?? 'Изменение сохранено.');
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
  const view: HostTab = tab ?? (finished ? 'results' : round ? 'live' : 'prepare');
  const status = finished
    ? { label: 'Встреча завершена', tone: 'done' }
    : !round
      ? { label: 'Ожидание вопроса', tone: 'idle' }
      : round.phase === 'open'
        ? { label: 'Приём открыт', tone: 'open' }
        : round.visible
          ? { label: 'Результаты открыты', tone: 'shown' }
          : { label: 'Приём закрыт', tone: 'closed' };
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
  const repeated = rounds.data.some((r) => r.slide.id === current.id);
  const isText = ['open-answers', 'word-cloud'].includes(current.type);
  const launchSettings = {
    ...config,
    cardLimit: current.type === 'open-answers' ? config.cardLimit : 1,
    moderation: isText && config.moderation,
  } as RoundSettings;
  const launchSummary = `${slideTypes.find(([type]) => type === current.type)?.[1]} · ${current.type === 'open-answers' ? `${launchSettings.cardLimit} ответ(а) на участника` : current.type === 'multiple-choice' ? 'один вариант ответа' : 'один ответ'} · ${config.immediate ? 'результаты во время сбора' : 'результаты после команды ведущего'}${launchSettings.moderation ? ' · текст после одобрения' : ''}`;
  async function applyAppearance(slide: SessionSlide) {
    if (dirty || !round) return;
    const ok = await run('save', {
      slides: m.slides.map((s) => (s.id === slide.id ? slide : s)),
      title: m.title,
      currentSlideId: m.currentSlideId,
      version: m.version,
    });
    if (ok) await run('appearance', { roundId: round.id });
  }
  function open() {
    if (
      repeated &&
      !openRequest &&
      !window.confirm(
        'Задать вопрос повторно? Начнётся новый сбор. Предыдущие ответы останутся в истории.',
      )
    )
      return;
    const requestId = openRequest ?? crypto.randomUUID();
    setOpenRequest(requestId);
    void run('open', { slideId: current.id, settings: launchSettings, requestId }).then((ok) => {
      if (ok) setTab('live');
    });
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
          Открыть экран проектора
        </a>
      </div>
      {!online && (
        <p className="notice" role="status">
          Нет соединения. Управление встречей недоступно.
        </p>
      )}
      {(error || room.error || responses.error || rounds.error || published.error) && (
        <p role="alert">
          {error || room.error || responses.error || rounds.error || published.error}
        </p>
      )}
      {(busy || notice) && (
        <p className="host-notice" role="status">
          {busy ? 'Выполняем…' : notice}
        </p>
      )}
      <section className="card control-panel status-panel">
        <div className="status-head">
          {view === 'prepare' && !finished ? (
            <label className="meeting-title">
              Название встречи
              <input
                value={draft.title}
                maxLength={150}
                disabled={busy}
                onChange={(e) => patch({ title: e.target.value })}
              />
            </label>
          ) : (
            <h2>{m.title}</h2>
          )}
          <div className="button-row">
            <span>
              Код: <strong>{m.joinCode}</strong>
            </span>
            <span className={`status-badge ${status.tone}`}>{status.label}</span>
          </div>
        </div>
      </section>
      <div className="host-tabs" role="tablist" aria-label="Режим работы">
        {(
          [
            ['prepare', 'Подготовка'],
            ['live', 'Эфир'],
            ['results', 'История'],
          ] as [HostTab, string][]
        )
          .filter(([key]) => key === 'results' || !finished)
          .map(([key, label]) => (
            <button
              key={key}
              role="tab"
              aria-selected={view === key}
              className="host-tab"
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
      </div>
      {view === 'live' && !finished && (
        <>
          {!round ? (
            <section className="card section-stack">
              <h2>Вопрос ещё не запущен</h2>
              <p>Присоединились: {joined}/100.</p>
              <button className="primary-action" onClick={() => setTab('prepare')}>
                Выбрать вопрос
              </button>
              <ParticipantConnection url={joinLink} onNotice={setNotice} onError={setError} />
            </section>
          ) : (
            <div className="live-workspace">
              <section className="card live-stage" aria-label="Текущий вопрос и результаты">
                <h2>{round.slide.title}</h2>
                <div className="live-states">
                  <span className={`status-badge ${round.phase === 'open' ? 'open' : 'closed'}`}>
                    {round.phase === 'open' ? 'Сбор ответов идёт' : 'Сбор завершён'}
                  </span>
                  <span className="status-badge">
                    {round.visible
                      ? 'Результаты видны участникам'
                      : 'Результаты скрыты от участников'}
                  </span>
                </div>
                {joined === 0 ? (
                  <p>Участники ещё не подключились.</p>
                ) : (
                  <>
                    <p>
                      Ответили {answered} из {Math.max(joined, answered)} присоединившихся.
                      Присоединились: {joined}/100.
                    </p>
                    {round.slide.type === 'open-answers' && (
                      <p>Карточек: {responses.data.length}.</p>
                    )}
                    <div className="status-progress">
                      <div
                        className="progress-track"
                        role="progressbar"
                        aria-label="Ответили участники"
                        aria-valuemin={0}
                        aria-valuemax={Math.max(joined, answered)}
                        aria-valuenow={answered}
                      >
                        <div
                          className="progress-fill"
                          style={{
                            width: `${Math.min(100, (answered / Math.max(joined, answered)) * 100)}%`,
                          }}
                        />
                      </div>
                      {round.deadline && round.phase === 'open' && (
                        <Countdown deadline={round.deadline} />
                      )}
                    </div>
                  </>
                )}
                <h3>Сейчас на проекторе</h3>
                {room.data?.frozen && (
                  <p className="notice">Проектор заморожен: показывает сохранённый снимок.</p>
                )}
                <LiveResults
                  round={room.data?.frozen?.round ?? round}
                  results={room.data?.frozen?.results ?? published.data}
                  emptyMessage={
                    responses.loaded && responses.data.length === 0 && !room.data?.frozen
                      ? 'На этот вопрос ещё никто не ответил.'
                      : 'Опубликованных ответов пока нет.'
                  }
                />
                {responses.data.some((r) => r.moderation === 'pending') && (
                  <p>
                    На проверке: {responses.data.filter((r) => r.moderation === 'pending').length}.
                    Одобрите ответы ниже, чтобы разрешить их показ.
                  </p>
                )}
              </section>
              <aside className="card live-controls" aria-label="Пульт ведущего">
                <h2>Управление вопросом</h2>
                <fieldset disabled={busy || !online} className="section-stack">
                  {round.phase === 'open' && (
                    <button className="primary-action" onClick={() => void run('close')}>
                      Завершить сбор ответов
                    </button>
                  )}
                  {round.phase === 'closed' && !round.visible && (
                    <button className="primary-action" onClick={() => void run('reveal')}>
                      Показать результаты
                    </button>
                  )}
                  {round.phase === 'closed' && (
                    <button
                      className={round.visible ? 'primary-action' : ''}
                      onClick={() => setTab('prepare')}
                    >
                      Следующий вопрос
                    </button>
                  )}
                  {round.phase === 'closed' &&
                    round.visible &&
                    round.slide.type === 'open-answers' && (
                      <button onClick={() => void run('likes', { enabled: !round.likesOpen })}>
                        {round.likesOpen ? 'Закрыть лайки' : 'Открыть лайки'}
                      </button>
                    )}
                </fieldset>
                {round.phase === 'open' && (
                  <Timer
                    round={round}
                    disabled={busy || !online}
                    onSet={(seconds) => void run('timer', { seconds })}
                  />
                )}
                <details className="live-extra">
                  <summary>Показ и оформление результатов</summary>
                  <button
                    disabled={busy || !online}
                    onClick={() => void run('freeze', { enabled: !room.data?.frozen })}
                  >
                    {room.data?.frozen ? 'Снять заморозку' : 'Заморозить проектор'}
                  </button>
                  <p>
                    Заморозка удерживает снимок на проекторе. Сбор ответов продолжается отдельно.
                  </p>
                  <fieldset disabled={busy || !online || dirty}>
                    <ResultAppearance
                      slide={m.slides.find((s) => s.id === round.slide.id) ?? round.slide}
                      onChange={(slide) => void applyAppearance(slide)}
                    />
                  </fieldset>
                  {dirty && <p>Сначала сохраните или отмените изменения в подготовке.</p>}
                  <p>Оформление применяется сразу. Формулировка и ответы сохраняются.</p>
                </details>
                <ParticipantConnection
                  key={round.id}
                  url={joinLink}
                  collapsed
                  onNotice={setNotice}
                  onError={setError}
                />
              </aside>
            </div>
          )}
          <details className="meeting-end">
            <summary>Завершение встречи</summary>
            <p>Завершит приём ответов по всей встрече. Результаты сохранятся в истории.</p>
            <button
              className="danger"
              disabled={busy || !online}
              onClick={() => {
                if (window.confirm('Завершить встречу? Приём ответов и лайков прекратится.'))
                  void run('finish');
              }}
            >
              Завершить встречу
            </button>
          </details>
        </>
      )}
      {view === 'prepare' && !finished && (
        <div className="host-workspace">
          <aside className="card slide-list">
            <h2>Вопросы</h2>
            {draft.slides.map((s, i) => {
              const Icon = slideIcons[s.type];
              return (
                <div className="slide-card" key={s.id}>
                  <div className="question-actions" role="group" aria-label={`Действия с вопросом ${i + 1}`}>
                    <button
                      type="button"
                      aria-label={`Поднять вопрос ${i + 1}`}
                      title="Поднять вопрос"
                      disabled={i === 0}
                      onClick={() => patch({ slides: moveSlide(draft.slides, s.id, 'up') })}
                    >
                      <ArrowUp size={18} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Опустить вопрос ${i + 1}`}
                      title="Опустить вопрос"
                      disabled={i === draft.slides.length - 1}
                      onClick={() => patch({ slides: moveSlide(draft.slides, s.id, 'down') })}
                    >
                      <ArrowDown size={18} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Создать копию вопроса ${i + 1}`}
                      title="Создать копию вопроса"
                      onClick={() => patch({ slides: duplicateSlide(draft.slides, s.id) })}
                    >
                      <Copy size={18} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="danger"
                      aria-label={`Удалить вопрос ${i + 1}`}
                      title={draft.slides.length === 1 ? 'Нельзя удалить единственный вопрос' : 'Удалить вопрос'}
                      disabled={draft.slides.length === 1}
                      onClick={() =>
                        patch({
                          slides: draft.slides.filter((x) => x.id !== s.id),
                          currentSlideId: draft.currentSlideId === s.id
                            ? draft.slides[i + 1]?.id ?? draft.slides[i - 1]!.id
                            : draft.currentSlideId,
                        })
                      }
                    >
                      <Trash2 size={18} aria-hidden="true" />
                    </button>
                  </div>
                  <button
                    className="slide-select"
                    aria-pressed={s.id === current.id}
                    onClick={() => setDraft((d) => (d ? { ...d, currentSlideId: s.id } : d))}
                  >
                    <Icon size={18} aria-hidden="true" />
                    <span>
                      {i + 1}. {s.title || 'Новый вопрос'}
                    </span>
                  </button>
                </div>
              );
            })}
            <h3>Добавить вопрос</h3>
            <div className="type-tiles">
              {slideTypes.map(([type, label]) => {
                const Icon = slideIcons[type];
                return (
                  <button key={type} className="type-tile" onClick={() => add(type)}>
                    <Icon size={22} aria-hidden="true" />
                    {label}
                  </button>
                );
              })}
            </div>
            <details className="template-list">
              <summary>Шаблоны вопросов</summary>
              {slideTemplates.map((t) => (
                <button key={t.id} title={t.description} onClick={() => add(t.type, t.id)}>
                  {t.label}
                </button>
              ))}
            </details>
          </aside>
          <section className="card section-stack">
            <h2>Подготовка вопроса</h2>
            <p>Подготовьте вопрос, проверьте предпросмотр и сохраните перед запуском.</p>
            <div className="editor-grid">
              <div className="editor-form">
                <fieldset disabled={busy}>
                  <legend className="sr-only">Редактор</legend>
                  <SlideEditor slide={current} onChange={slideChange} />
                </fieldset>
                <fieldset disabled={busy} className="question-settings">
                  <legend>Как собирать ответы</legend>
                  {current.type === 'multiple-choice' && <p>Участник выбирает один вариант.</p>}
                  {current.type === 'open-answers' && (
                    <label>
                      Карточек на участника
                      <select
                        value={config.cardLimit}
                        onChange={(e) =>
                          setConfig({ ...config, cardLimit: Number(e.target.value) as 1 | 3 })
                        }
                      >
                        <option value={1}>1</option>
                        <option value={3}>3</option>
                      </select>
                    </label>
                  )}
                  {isText && (
                    <label className="choice">
                      <input
                        type="checkbox"
                        checked={config.moderation}
                        onChange={(e) => setConfig({ ...config, moderation: e.target.checked })}
                      />
                      Одобрять свободный текст перед публикацией
                    </label>
                  )}
                  <label>
                    Когда показывать результаты
                    <select
                      value={config.immediate ? 'immediate' : 'after'}
                      onChange={(e) =>
                        setConfig({ ...config, immediate: e.target.value === 'immediate' })
                      }
                    >
                      <option value="immediate">Во время сбора</option>
                      <option value="after">После команды ведущего</option>
                    </select>
                  </label>
                  <small>Эти настройки применятся при запуске выбранного вопроса.</small>
                </fieldset>
              </div>
              <div className="editor-side">
                <QuestionPreview key={current.id} slide={current} settings={launchSettings} />
              </div>
            </div>
            <p className="launch-summary">{launchSummary}</p>
            {repeated && (
              <p>Повторный запуск начнёт новый сбор; прежние ответы останутся в истории.</p>
            )}
            {round?.phase === 'open' && <p>Запуск завершит сбор ответов на текущий вопрос.</p>}
            <div className="save-bar">
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
                Сохранить изменения
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
              <button
                className="primary-action launch"
                disabled={busy || !online || dirty}
                onClick={open}
              >
                {openRequest
                  ? 'Повторить попытку запуска'
                  : rounds.data.some((r) => r.slide.id === current.id)
                    ? 'Задать вопрос повторно'
                    : 'Запустить вопрос'}
              </button>
              {dirty ? (
                <p className="save-state dirty">
                  Есть несохранённые изменения. Сохраните перед запуском.
                </p>
              ) : (
                <p className="save-state">Вопрос сохранён.</p>
              )}
            </div>
          </section>
        </div>
      )}
      {view === 'live' && round && !finished && (
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
      {round && finished && view === 'results' && (
        <section className="card">
          <h2>Сейчас на проекторе</h2>
          <LiveResults
            round={room.data?.frozen?.round ?? round}
            results={room.data?.frozen?.results ?? published.data}
          />
        </section>
      )}
      {view === 'results' && (
        <section className="card">
          <h2>История и данные</h2>
          <label>
            История запусков вопросов
            <select value={historyId} onChange={(e) => setHistoryId(e.target.value)}>
              <option value="">Выберите вопрос и время запуска</option>
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
      )}
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
      <details>
        <summary>Оформление результатов</summary>
        <ResultAppearance slide={slide} onChange={onChange} />
      </details>
    </div>
  );
}
function ResultAppearance({
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
    <div>
      {slide.type === 'multiple-choice' && (
        <>
          {' '}
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
      )}{' '}
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
function ParticipantConnection({
  url,
  collapsed = false,
  onNotice,
  onError,
}: {
  url: string;
  collapsed?: boolean;
  onNotice: (text: string) => void;
  onError: (text: string) => void;
}) {
  return (
    <details className="participant-connection" open={!collapsed}>
      <summary>Подключение участников</summary>
      <p>Участники сканируют QR-код или открывают ссылку на своём устройстве.</p>
      <div className="connection-content">
        <JoinQr url={url} />
        <div>
          <p className="join-url">{url}</p>
          <button
            onClick={() => {
              navigator.clipboard
                .writeText(url)
                .then(() => onNotice('Ссылка скопирована.'))
                .catch(() => onError('Не удалось скопировать. Выделите ссылку выше.'));
            }}
          >
            Скопировать ссылку
          </button>
        </div>
      </div>
    </details>
  );
}
type ModerationFilter = 'pending' | 'approved' | 'hidden' | 'all';
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
  const [filterChoice, setFilter] = useState<ModerationFilter | null>(null);
  const [editing, setEditing] = useState<{ id: string; text: string; revision: number } | null>(
    null,
  );
  if (!texts.length) return null;
  const count = (status: string) => texts.filter((r) => r.moderation === status).length;
  const pending = texts.filter((r) => r.moderation === 'pending');
  const filter: ModerationFilter = filterChoice ?? (pending.length ? 'pending' : 'all');
  const visible = filter === 'all' ? texts : texts.filter((r) => r.moderation === filter);
  const filters: [ModerationFilter, string, number][] = [
    ['pending', 'На проверке', count('pending')],
    ['approved', 'Одобрено', count('approved')],
    ['hidden', 'Скрыто', count('hidden')],
    ['all', 'Все', texts.length],
  ];
  const approveMany = (ids: string[]) => {
    onAction({ ids: ids.slice(0, 100), status: 'approved' });
    setSelected([]);
  };
  return (
    <section className="card moderation">
      <h2>Модерация ответов</h2>
      <div className="host-tabs" role="group" aria-label="Фильтр ответов">
        {filters.map(([key, label, n]) => (
          <button
            key={key}
            className="host-tab"
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
          >
            {label} ({n})
          </button>
        ))}
      </div>
      <div className="button-row">
        <button
          className="primary-action"
          disabled={busy || !pending.length}
          onClick={() => approveMany(pending.map((r) => r.id))}
        >
          Одобрить все ожидающие ({Math.min(pending.length, 100)})
        </button>
        <button disabled={busy || !selected.length} onClick={() => approveMany(selected)}>
          Одобрить выбранные (до 100)
        </button>
        <button
          disabled={!visible.length}
          onClick={() =>
            setSelected((ids) =>
              visible.every((r) => ids.includes(r.id))
                ? ids.filter((id) => !visible.some((r) => r.id === id))
                : [...new Set([...ids, ...visible.map((r) => r.id)])],
            )
          }
        >
          {visible.length > 0 && visible.every((r) => selected.includes(r.id))
            ? 'Снять выделение'
            : 'Выбрать все в списке'}
        </button>
      </div>
      {!visible.length && <p>В этой категории пока нет ответов.</p>}
      <div className="answer-grid">
        {visible.map((r) => (
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
          </article>
        ))}
      </div>
      {editing && (
        <Modal>
          <h3>Редакция ведущего</h3>
          <p>Участник увидит пометку, что ответ отредактирован. Оригинал сохранится.</p>
          <textarea
            aria-label="Редакция ведущего"
            autoFocus
            rows={4}
            value={editing.text}
            onChange={(e) => setEditing({ ...editing, text: e.target.value })}
          />
          <div className="button-row">
            <button
              className="primary-action"
              disabled={busy || !editing.text.trim()}
              onClick={() => {
                onAction({
                  ids: [editing.id],
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
          </div>
        </Modal>
      )}
    </section>
  );
}
function Countdown({ deadline }: { deadline: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const left = Math.max(0, Math.ceil((Date.parse(deadline) - now) / 1000));
  const text = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  return (
    <span className={`countdown${left === 0 ? ' expired' : ''}`} aria-hidden="true">
      {text}
    </span>
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
      <p className="timer-help">
        Таймер только предупреждает: по окончании сбор останется открытым.
      </p>
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
