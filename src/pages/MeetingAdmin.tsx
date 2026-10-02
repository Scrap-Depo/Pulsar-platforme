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
import { BarChart3, Cloud, Gauge, MessageSquare } from 'lucide-react';
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
  function open() {
    const requestId = openRequest ?? crypto.randomUUID();
    setOpenRequest(requestId);
    void run('open', { slideId: current.id, settings: config, requestId }).then((ok) => {
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
      <section className="card control-panel status-panel">
        <div className="status-head">
          <h2>{m.title}</h2>
          <span className={`status-badge ${status.tone}`}>{status.label}</span>
        </div>
        <p>
          Код: <strong>{m.joinCode}</strong>
        </p>
        <p>
          Присоединились: {joined}/100. Ответили на текущий вопрос: {answered}. Карточек:{' '}
          {responses.data.length}.
        </p>
        {round && !finished && (
          <div className="status-progress">
            <div
              className="progress-track"
              role="progressbar"
              aria-label="Ответили участники"
              aria-valuemin={0}
              aria-valuemax={Math.max(joined, answered, 1)}
              aria-valuenow={answered}
            >
              <div
                className="progress-fill"
                style={{
                  width: `${Math.min(100, (answered / Math.max(joined, answered, 1)) * 100)}%`,
                }}
              />
            </div>
            <span>
              {answered} из {Math.max(joined, answered)}
            </span>
            {round.deadline && round.phase === 'open' && <Countdown deadline={round.deadline} />}
          </div>
        )}
        <p>
          {finished
            ? 'Встреча завершена'
            : round
              ? `${round.slide.title} — ${round.phase === 'open' ? 'приём открыт' : 'приём закрыт'}; результаты ${round.visible ? 'открыты' : 'скрыты'}`
              : 'Ожидает первого вопроса'}
        </p>
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
        <section className="card control-panel">
          <h2>Управление эфиром</h2>
          <p>
            Для зала откройте чистый экран без пульта и разверните его на проектор (в браузере —
            F11).
          </p>
          <a className="screen-link" href={projectorLink} target="_blank" rel="noreferrer">
            Экран для аудитории
          </a>
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
          <fieldset disabled={busy || !online} className="button-row">
            <legend className="sr-only">Управление эфиром</legend>
            {!round && <p>Запустите вопрос на вкладке «Подготовка».</p>}
            {round?.phase === 'open' && (
              <button className="primary-action" onClick={() => void run('close')}>
                Завершить сбор ответов
              </button>
            )}
            {round?.phase === 'closed' && !round.visible && (
              <button className="primary-action" onClick={() => void run('reveal')}>
                Показать результаты
              </button>
            )}
            {round?.phase === 'closed' && round.visible && (
              <button className="primary-action" onClick={() => setTab('prepare')}>
                Следующий вопрос
              </button>
            )}
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
          <div className="danger-zone">
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
          </div>
        </section>
      )}
      {view === 'prepare' && !finished && (
        <div className="host-workspace">
          <aside className="card slide-list">
            <h2>Слайды</h2>
            {draft.slides.map((s, i) => {
              const Icon = slideIcons[s.type];
              return (
                <div className="slide-card" key={s.id}>
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
                  <details className="slide-menu">
                    <summary aria-label={`Действия со слайдом ${i + 1}`}>⋯</summary>
                    <div className="slide-menu-items">
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
                        className="danger"
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
                  </details>
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
              <summary>Готовые упражнения</summary>
              {slideTemplates.map((t) => (
                <button key={t.id} title={t.description} onClick={() => add(t.type, t.id)}>
                  {t.label}
                </button>
              ))}
            </details>
          </aside>
          <section className="card section-stack">
            <h2>Подготовка вопроса</h2>
            <p>
              Изменения вопроса появятся у участников после сохранения и запуска. Вопрос, на который
              уже отвечают участники, сохраняет свою формулировку.
            </p>
            <div className="editor-grid">
              <div className="editor-form">
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
                <fieldset disabled={busy}>
                  <legend>Как собирать ответы</legend>
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
              </div>
              <div className="editor-side">
                <QuestionPreview key={current.id} slide={current} settings={config} />
                <p>
                  Запуск показывает выбранный вопрос участникам и завершает предыдущий сбор. Для
                  этого запуска ответы собираются заново; прежние доступны в истории.
                </p>
                <button
                  disabled={busy || dirty || !round || !online || current.id !== round.slide.id}
                  onClick={() => void run('appearance')}
                >
                  Обновить вид результатов
                </button>
                <p>
                  Меняет только вид результатов текущего вопроса. Сначала выберите этот вопрос и
                  сохраните изменения. Формулировка и ответы сохраняются.
                </p>
              </div>
            </div>
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
                <p className="save-state dirty">Есть несохранённые изменения.</p>
              ) : (
                <p className="save-state">Все изменения сохранены.</p>
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
      {round && (view === 'live' ? !finished : finished && view === 'results') && (
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
