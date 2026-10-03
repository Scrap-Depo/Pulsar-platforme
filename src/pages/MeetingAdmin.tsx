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
  slideTitlePlaceholderMap,
  duplicateSlide,
  moveSlide,
  slideTemplates,
} from '../shared/lib/session';
import LiveResults from './LiveResults';
import QuestionPreview from './QuestionPreview';
import RoundHistory from './RoundHistory';
import { questionLaunchSettings, launchProblem } from '../shared/lib/launch';
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  Cloud,
  Copy,
  Gauge,
  MessageSquare,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Check,
  ExternalLink,
} from 'lucide-react';
import Modal from '../shared/ui/Modal';
import JoinQr from '../shared/ui/JoinQr';
import './MeetingNavigation.css';

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
        slides: [{ ...createSlide('multiple-choice', 0), id: `slide-${crypto.randomUUID()}` }],
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
  const [navigationError, setNavigationError] = useState('');
  const navigationRef = useRef(false);
  const navigationRequest = useRef<{ slideId: string; requestId: string } | null>(null);
  const [deleteText, setDeleteText] = useState('');
  const [historyId, setHistoryId] = useState('');
  const [openRequest, setOpenRequest] = useState<string | null>(null);
  const [tab, setTab] = useState<HostTab | null>(null);
  const [selectedCard, setSelectedCard] = useState<{ roundId: string; id: string } | null>(null);
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
        navigate: result.restored
          ? 'Показаны сохранённые ответы. Новый сбор не начат.'
          : 'Вопрос запущен. Участники могут отвечать.',
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
  const card =
    selectedCard?.roundId === round?.id
      ? responses.data.find((response) => response.id === selectedCard?.id)
      : undefined;
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
    if (busyRef.current) return;
    const slide = template
      ? createTemplateSlide(template, draft!.slides.length)
      : createSlide(type, draft!.slides.length);
    slide.id = `slide-${crypto.randomUUID()}`;
    patch({ slides: [...draft!.slides, slide], currentSlideId: slide.id });
  }
  const repeated = rounds.data.some((r) => r.slide.id === current.id);
  const currentIsOpen = round?.slide.id === current.id && round.phase === 'open';
  async function launchFromLive(slide: SessionSlide) {
    if (busyRef.current || navigationRef.current || !online || finished) return;
    setNavigationError('');
    if (round?.slide.id === slide.id) return;
    const problem = rounds.data.some((r) => r.slide.id === slide.id) ? null : launchProblem(slide);
    if (problem) {
      setNavigationError(`«${slide.title || 'Без названия'}»: ${problem}`);
      return;
    }
    navigationRef.current = true;
    try {
      if (dirty) {
        const saved = await run('save', {
          slides: draft!.slides,
          title: draft!.title,
          currentSlideId: slide.id,
          version: draft!.version,
        });
        if (!saved) {
          setNavigationError('Не удалось сохранить правки. Новый вопрос не запущен.');
          return;
        }
      }
      const request =
        navigationRequest.current?.slideId === slide.id
          ? navigationRequest.current
          : { slideId: slide.id, requestId: crypto.randomUUID() };
      navigationRequest.current = request;
      const opened = await run('navigate', { ...request, settings: questionLaunchSettings(slide) });
      if (opened) {
        navigationRequest.current = null;
        setDraft((previous) => (previous ? { ...previous, currentSlideId: slide.id } : previous));
        setTab('live');
      } else
        setNavigationError(
          'Запуск не подтверждён. Нажмите на вопрос ещё раз, чтобы повторить попытку.',
        );
    } finally {
      navigationRef.current = false;
    }
  }
  const isText = ['open-answers', 'word-cloud'].includes(current.type);
  const config = questionLaunchSettings(current);
  const launchSettings = config;
  const problem = launchProblem(current);
  function setConfig(settings: RoundSettings) {
    slideChange({ ...current, launch: settings });
  }
  const launchSummary = `${slideTypes.find(([type]) => type === current.type)?.[1]} · ${current.type === 'open-answers' ? `${launchSettings.cardLimit} ответ(а) на участника` : current.type === 'multiple-choice' ? 'один вариант ответа' : 'один ответ'} · ${config.immediate ? 'результаты во время сбора' : 'результаты после команды ведущего'}${launchSettings.moderation ? ' · текст после одобрения' : ''}${isText && config.contentFilter !== false ? ' · фильтр чувствительных тем включён' : ''} · ${config.showOnPhones ? 'результаты на телефонах включены' : 'результаты на телефонах выключены'}`;
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
    if (busy || !online || dirty || problem) return;
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
      </div>
      {dirty && view !== 'prepare' && !finished && (
        <div className="notice draft-reminder" role="status">
          <p>В подготовке есть несохранённые изменения. Текущий вопрос у участников не изменён.</p>
          <button type="button" onClick={() => setTab('prepare')}>
            Вернуться к изменениям
          </button>
        </div>
      )}
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
              Код:{' '}
              <strong className="join-code" aria-label={`Код входа ${m.joinCode}`}>
                {m.joinCode.match(m.joinCode.length === 6 ? /.{1,3}/g : /.{1,5}/g)?.join(' ')}
              </strong>
            </span>
            {view !== 'live' || !round ? (
              <span className={`status-badge ${status.tone}`}>{status.label}</span>
            ) : null}
          </div>
        </div>
      </section>
      <div className={`host-mode-navigation${finished ? ' is-finished' : ''}`}>
        <div className="host-tabs" role="tablist" aria-label="Режим работы">
          {(
            [
              ['prepare', 'Подготовка'],
              ['live', 'Показ'],
              ['results', 'История'],
            ] as [HostTab, string][]
          )
            .filter(([key]) => !finished || key === 'results')
            .map(([key, label]) => (
              <button
                key={key}
                role="tab"
                disabled={busy}
                aria-selected={view === key}
                className="host-tab"
                onClick={() => {
                  setNotice('');
                  setTab(key);
                }}
              >
                {label}
              </button>
            ))}
        </div>
        <a className="projector-open-action" href={projectorLink} target="_blank" rel="noreferrer">
          <ExternalLink size={18} aria-hidden="true" />
          Открыть экран просмотра
        </a>
      </div>
      {view === 'live' && !finished && (
        <>
          <LiveQuestionRail
            slides={draft.slides}
            liveId={round?.slide.id}
            doneIds={rounds.data.map((r) => r.slide.id)}
            disabled={busy || !online}
            onLaunch={launchFromLive}
            error={navigationError}
          />
          {!round ? (
            <section className="card section-stack">
              <h2>Вопрос ещё не запущен</h2>
              <p>Присоединились: {joined}/100.</p>
              <button className="primary-action" onClick={() => setTab('prepare')}>
                Выбрать вопрос
              </button>
              <ParticipantConnection
                code={m.joinCode}
                url={joinLink}
                onNotice={setNotice}
                onError={setError}
              />
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
                {joined > 0 && (
                  <p className="big-stat" aria-hidden="true">
                    <strong>{answered}</strong> из {Math.max(joined, answered)} ответили
                  </p>
                )}
                <p>Ответов: {responses.data.length}.</p>
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
                <h3>Так видит зал</h3>
                {round.slide.type === 'open-answers' && published.data.length > 0 && (
                  <small>Нажмите на текст карточки, чтобы скрыть или удалить её.</small>
                )}
                <div className="projector-same-question">
                  {!round.visible ? (
                    <p>На экране проектора только вопрос.</p>
                  ) : (
                    <LiveResults
                      round={round}
                      results={published.data}
                      onResponseSelect={(id) => setSelectedCard({ roundId: round.id, id })}
                      emptyMessage={
                        responses.loaded && responses.data.length === 0
                          ? 'На этот вопрос ещё никто не ответил.'
                          : 'Опубликованных ответов пока нет.'
                      }
                    />
                  )}
                </div>
                {responses.data.some((r) => r.moderation === 'pending') && (
                  <p>
                    На проверке: {responses.data.filter((r) => r.moderation === 'pending').length}.
                    Одобрите ответы ниже, чтобы разрешить их показ.
                  </p>
                )}
              </section>
              <aside className="card live-controls" aria-label="Пульт ведущего">
                <h2>Управление вопросом</h2>
                {['open-answers', 'word-cloud'].includes(round.slide.type) && (
                  <fieldset disabled={busy || !online} className="live-moderation-settings">
                    <label className="choice">
                      <input
                        type="checkbox"
                        checked={round.settings.moderation}
                        onChange={(e) =>
                          void run('moderationSettings', {
                            roundId: round.id,
                            moderation: e.target.checked,
                          })
                        }
                      />
                      Модерация ответов
                    </label>
                    <label className="choice">
                      <input
                        type="checkbox"
                        checked={round.settings.contentFilter !== false}
                        onChange={(e) =>
                          void run('moderationSettings', {
                            roundId: round.id,
                            moderation: round.settings.moderation,
                            contentFilter: e.target.checked,
                          })
                        }
                      />
                      Фильтр чувствительных тем
                    </label>
                    <small>
                      Подозрительные ответы ждут одобрения. Фильтр по словам может ошибаться.
                    </small>
                  </fieldset>
                )}
                {round.phase === 'open' && (
                  <button
                    disabled={busy || !online}
                    onClick={() => void run('close', { roundId: round.id })}
                  >
                    Завершить сбор ответов
                  </button>
                )}
                <fieldset disabled={busy || !online} className="section-stack live-quick-actions">
                  {!round.visible && (
                    <button
                      className="primary-action"
                      onClick={() => void run('reveal', { roundId: round.id })}
                    >
                      Показать результаты
                    </button>
                  )}
                  {round.visible && round.slide.type === 'open-answers' && (
                    <div className="likes-control">
                      <p className={`likes-state${round.likesOpen ? ' on' : ''}`}>
                        Лайки: {round.likesOpen ? 'открыты' : 'закрыты'}
                      </p>
                      <button
                        onClick={() =>
                          void run('likes', { enabled: !round.likesOpen, roundId: round.id })
                        }
                      >
                        {round.likesOpen ? 'Закрыть лайки' : 'Открыть лайки'}
                      </button>
                    </div>
                  )}
                </fieldset>
                <details className="presenter-tools">
                  <summary>Дополнительное управление</summary>
                  {round.phase === 'open' && (
                    <Timer
                      round={round}
                      disabled={busy || !online}
                      onSet={(seconds) => void run('timer', { seconds })}
                    />
                  )}
                  <details className="live-extra">
                    <summary>Показ и оформление результатов</summary>
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
                    code={m.joinCode}
                    collapsed
                    onNotice={setNotice}
                    onError={setError}
                  />
                </details>
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
            <ParticipantConnection
              url={joinLink}
              code={m.joinCode}
              collapsed
              onNotice={setNotice}
              onError={setError}
            />
            {draft.slides.map((s, i) => {
              const Icon = slideIcons[s.type];
              return (
                <div
                  className={`slide-card${s.id === current.id ? ' is-selected' : ''}`}
                  key={s.id}
                >
                  <div
                    className="question-actions"
                    role="group"
                    aria-label={`Действия с вопросом ${i + 1}`}
                  >
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
                      title={
                        draft.slides.length === 1
                          ? 'Нельзя удалить единственный вопрос'
                          : 'Удалить вопрос'
                      }
                      disabled={draft.slides.length === 1}
                      onClick={() =>
                        patch({
                          slides: draft.slides.filter((x) => x.id !== s.id),
                          currentSlideId:
                            draft.currentSlideId === s.id
                              ? (draft.slides[i + 1]?.id ?? draft.slides[i - 1]!.id)
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
                      {i + 1}. {s.title || 'Без названия'}
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
                  <button
                    key={type}
                    className="type-tile"
                    disabled={busy}
                    onClick={() => add(type)}
                  >
                    <Icon size={22} aria-hidden="true" />
                    {label}
                  </button>
                );
              })}
            </div>
            <details className="template-list">
              <summary>Шаблоны вопросов</summary>
              {slideTemplates.map((t) => (
                <button
                  key={t.id}
                  title={t.description}
                  disabled={busy}
                  onClick={() => add(t.type, t.id)}
                >
                  {t.label}
                </button>
              ))}
            </details>
          </aside>
          <section className="card section-stack">
            <h2>Подготовка вопроса</h2>
            <p>Подготовьте вопрос, проверьте предпросмотр и сохраните перед запуском.</p>
            {round && (
              <p className="preparation-context">
                Текущий вопрос у участников: «{round.slide.title}».{' '}
                {round.phase === 'open' ? 'Сбор ответов продолжается.' : 'Сбор ответов завершён.'}
              </p>
            )}
            {currentIsOpen &&
              (dirty || JSON.stringify(current) !== JSON.stringify(round.slide)) && (
                <p className="preparation-context">
                  Показывается сохранённая при запуске версия; изменения редактора ещё не
                  опубликованы.
                </p>
              )}
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
                          setConfig({ ...config, cardLimit: Number(e.target.value) as 1 | 3 | 5 })
                        }
                      >
                        <option value={1}>1</option>
                        <option value={3}>3</option>
                        <option value={5}>5</option>
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
                  {isText && (
                    <label className="choice">
                      <input
                        type="checkbox"
                        checked={config.contentFilter !== false}
                        onChange={(e) => setConfig({ ...config, contentFilter: e.target.checked })}
                      />
                      Проверять мат, угрозы и политические темы перед показом
                    </label>
                  )}
                  <label>
                    Когда показывать результаты
                    <select
                      disabled={isText && !config.moderation}
                      value={config.immediate ? 'immediate' : 'after'}
                      onChange={(e) =>
                        setConfig({ ...config, immediate: e.target.value === 'immediate' })
                      }
                    >
                      <option value="immediate">Во время сбора</option>
                      <option value="after">После команды ведущего</option>
                    </select>
                  </label>
                  <label className="choice">
                    <input
                      type="checkbox"
                      checked={config.showOnPhones === true}
                      onChange={(e) => setConfig({ ...config, showOnPhones: e.target.checked })}
                    />
                    Показывать результаты на телефонах участников
                  </label>
                  {isText && !config.moderation && (
                    <small>
                      Без модерации ответы показываются сразу; отмеченные фильтром ждут одобрения.
                    </small>
                  )}
                  <small>Эти настройки применятся при запуске выбранного вопроса.</small>
                </fieldset>
              </div>
              <div className="editor-side">
                <QuestionPreview key={current.id} slide={current} settings={launchSettings} />
              </div>
            </div>
            <p className="launch-summary">{launchSummary}</p>
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
              <div className="launch-controls">
                {currentIsOpen ? (
                  <>
                    <button
                      className="primary-action"
                      disabled={busy}
                      onClick={() => {
                        setNotice('');
                        setTab('live');
                      }}
                    >
                      Перейти к показу
                    </button>
                    <p>Этот вопрос сейчас показывается.</p>
                    <details>
                      <summary>Начать новый сбор на этот вопрос</summary>
                      <button disabled={busy || !online || dirty || !!problem} onClick={open}>
                        {openRequest ? 'Повторить попытку запуска' : 'Задать вопрос повторно'}
                      </button>
                      <p>
                        Повторный запуск завершит текущий сбор и начнёт новый. Прежние ответы
                        останутся в истории.
                      </p>
                    </details>
                  </>
                ) : (
                  <>
                    <button
                      className="primary-action"
                      disabled={busy || !online || dirty || !!problem}
                      onClick={open}
                    >
                      {openRequest
                        ? 'Повторить попытку запуска'
                        : repeated
                          ? 'Задать вопрос повторно'
                          : 'Запустить вопрос'}
                    </button>
                    {repeated && (
                      <p>Повторный запуск начнёт новый сбор; прежние ответы останутся в истории.</p>
                    )}
                    {round?.phase === 'open' && (
                      <p>Запуск завершит сбор ответов на текущий вопрос.</p>
                    )}
                  </>
                )}
              </div>
              {problem && (
                <p className="save-state dirty" role="status">
                  {problem}
                </p>
              )}
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
      {view === 'live' &&
        round &&
        !finished &&
        ['open-answers', 'word-cloud'].includes(round.slide.type) && (
          <Moderation
            responses={responses.data}
            busy={busy || !online}
            onSelect={(id) => setSelectedCard({ roundId: round.id, id })}
            onAction={(params) =>
              void run('moderate', {
                ...params,
                roundId: round.id,
                revisions: Object.fromEntries(responses.data.map((r) => [r.id, r.revision])),
              })
            }
          />
        )}
      {card && round && view === 'live' && !finished && (
        <Modal>
          <h3>Карточка участника</h3>
          <p className="host-card-text">{card.displayValue ?? card.value}</p>
          {!!card.filterReasons?.length && (
            <p>
              Фильтр: {card.filterReasons.join(', ')}. Это повод проверить текст, а не окончательная
              оценка.
            </p>
          )}
          <div className="button-row">
            <button
              disabled={busy || !online}
              onClick={() =>
                void run('moderate', {
                  roundId: round.id,
                  ids: [card.id],
                  revisions: { [card.id]: card.revision },
                  status: card.moderation === 'approved' ? 'hidden' : 'approved',
                }).then((ok) => {
                  if (ok) setSelectedCard(null);
                })
              }
            >
              {card.moderation === 'approved' ? 'Скрыть карточку' : 'Опубликовать карточку'}
            </button>
            <button
              className="danger"
              disabled={busy || !online}
              onClick={() => {
                if (
                  window.confirm(
                    'Удалить карточку без возможности восстановления? Текст и лайки будут удалены, повторная отправка этой карточки заблокирована.',
                  )
                )
                  void run('deleteResponse', {
                    roundId: round.id,
                    responseId: card.id,
                    revision: card.revision,
                  }).then((ok) => {
                    if (ok) setSelectedCard(null);
                  });
              }}
            >
              Удалить карточку
            </button>
            <button autoFocus disabled={busy} onClick={() => setSelectedCard(null)}>
              Закрыть
            </button>
          </div>
          <p>Скрытая карточка остаётся в истории и может быть опубликована снова.</p>
          {error && <p role="alert">{error}</p>}
        </Modal>
      )}
      {round && finished && view === 'results' && (
        <section className="card">
          <h2>Сейчас на проекторе</h2>
          <LiveResults round={round} results={published.data} />
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
          <p>
            Данные хранятся до удаления ведущим. Результаты закрытого вопроса можно скачать выше;
            полную встречу — после завершения.
          </p>
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
          placeholder={slideTitlePlaceholderMap[slide.type]}
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
                  placeholder={`Вариант ${i + 1}`}
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
                className="text-action"
                disabled={slide.options.length <= 2}
                onClick={() => patch({ options: slide.options.filter((x) => x.id !== o.id) })}
              >
                Убрать
              </button>
            </div>
          ))}
          <button
            className="secondary-action"
            disabled={slide.options.length >= 10}
            onClick={() =>
              patch({
                options: [
                  ...slide.options,
                  { id: Date.now(), text: '', votes: 0, color: '#479ddb' },
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
  code,
  collapsed = false,
  onNotice,
  onError,
}: {
  url: string;
  code: string;
  collapsed?: boolean;
  onNotice: (text: string) => void;
  onError: (text: string) => void;
}) {
  const [expanded, setExpanded] = useState(!collapsed);
  useEffect(() => {
    if (!collapsed) setExpanded(true);
  }, [collapsed]);
  return (
    <details
      className="participant-connection"
      open={expanded}
      onToggle={(e) => setExpanded(e.currentTarget.open)}
    >
      <summary>Подключение участников</summary>
      <p className="join-code" aria-label={`Код входа ${code}`}>
        {code.match(code.length === 6 ? /.{1,3}/g : /.{1,5}/g)?.join(' ')}
      </p>
      <button
        onClick={() => {
          navigator.clipboard
            .writeText(code)
            .then(() => onNotice('Код скопирован.'))
            .catch(() => onError('Не удалось скопировать. Выделите код выше.'));
        }}
      >
        Скопировать код
      </button>
      <p>Участники сканируют QR-код или открывают ссылку на своём устройстве.</p>
      <div className="connection-content">
        <JoinQr url={url} downloadable />
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
          <a className="quiet-link" href={url} target="_blank" rel="noreferrer">
            Вход участника
          </a>
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
  onSelect,
}: {
  responses: Response[];
  busy: boolean;
  onAction: (params: Record<string, unknown>) => void;
  onSelect: (id: string) => void;
}) {
  const texts = responses.filter((r) => ['open-answers', 'word-cloud'].includes(r.type));
  const [selected, setSelected] = useState<string[]>([]);
  const [filterChoice, setFilter] = useState<ModerationFilter | null>(null);
  const [editing, setEditing] = useState<{ id: string; text: string; revision: number } | null>(
    null,
  );
  const count = (status: string) => texts.filter((r) => r.moderation === status).length;
  const pending = texts.filter((r) => r.moderation === 'pending');
  const [expanded, setExpanded] = useState(pending.length > 0);
  useEffect(() => {
    if (pending.length > 0) setExpanded(true);
  }, [pending.length]);
  if (!texts.length) return null;
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
    <details
      className="card moderation"
      open={expanded}
      onToggle={(e) => setExpanded(e.currentTarget.open)}
    >
      <summary>Управление карточками · На проверке: {pending.length}</summary>
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
            {!!r.filterReasons?.length && <small>Фильтр: {r.filterReasons.join(', ')}</small>}
            {r.displayValue && (
              <details>
                <summary>Оригинал участника</summary>
                <p>{r.value}</p>
              </details>
            )}
            <div className="button-row">
              <button disabled={busy} onClick={() => onSelect(r.id)}>
                Действия с карточкой
              </button>
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
    </details>
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
      <details className="timer-settings">
        <summary>Таймер (необязательно)</summary>
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
      </details>
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
function removeDrafts(sessionId: string) {
  try {
    Object.keys(localStorage)
      .filter((key) => key.startsWith('pulsar.draft.v2:') && key.includes(`:${sessionId}:`))
      .forEach((key) => localStorage.removeItem(key));
  } catch {
    /* Remote data is already deleted. */
  }
}

function LiveQuestionRail({
  slides,
  liveId,
  doneIds,
  disabled,
  onLaunch,
  error,
}: {
  slides: SessionSlide[];
  liveId?: string;
  doneIds: string[];
  disabled: boolean;
  onLaunch: (slide: SessionSlide) => Promise<void>;
  error: string;
}) {
  const index = slides.findIndex((slide) => slide.id === liveId);
  const previous = index > 0 ? slides[index - 1] : undefined;
  const next = slides[index + 1];
  useEffect(() => {
    const navigate = (event: KeyboardEvent) => {
      if (
        disabled ||
        event.repeat ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.shiftKey
      )
        return;
      const target = event.target instanceof Element ? event.target : null;
      if (
        target?.closest(
          'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="slider"]',
        )
      )
        return;
      // PageUp/PageDown are what presentation clickers send.
      const slide = ['ArrowLeft', 'PageUp'].includes(event.key)
        ? previous
        : ['ArrowRight', 'PageDown'].includes(event.key)
          ? next
          : undefined;
      if (slide) {
        event.preventDefault();
        void onLaunch(slide);
      }
    };
    window.addEventListener('keydown', navigate);
    return () => window.removeEventListener('keydown', navigate);
  }, [disabled, previous, next, onLaunch]);
  return (
    <section className="card live-question-rail" aria-label="Вопросы показа">
      <div className="rail-controls">
        <button
          className="rail-back"
          aria-label="Назад"
          disabled={disabled || !previous}
          onClick={() => previous && void onLaunch(previous)}
        >
          <ChevronLeft size={22} aria-hidden="true" />
          <span>Назад</span>
        </button>
        <p className="rail-position">
          {index >= 0 ? `Вопрос ${index + 1} из ${slides.length}` : 'Выберите вопрос'}
          <small>Стрелки ← → или PageUp / PageDown</small>
        </p>
        <button
          className="primary-action rail-next"
          aria-label="Далее"
          disabled={disabled || !next}
          onClick={() => next && void onLaunch(next)}
        >
          <span className="rail-next-label">
            Далее <ChevronRight size={22} aria-hidden="true" />
          </span>
          {next && <small aria-hidden="true">{next.title || 'Без названия'}</small>}
        </button>
      </div>
      <div className="question-strip">
        {slides.map((slide, i) => {
          const Icon = slideIcons[slide.type];
          return (
            <button
              key={slide.id}
              aria-label={`Запустить вопрос ${i + 1}: ${slide.title || 'Без названия'}`}
              aria-pressed={slide.id === liveId}
              className={doneIds.includes(slide.id) && slide.id !== liveId ? 'is-done' : undefined}
              disabled={disabled}
              onClick={() => void onLaunch(slide)}
            >
              <Icon size={18} aria-hidden="true" />
              <span>
                {i + 1} · {slide.title || 'Без названия'}
              </span>
              {slide.id === liveId ? (
                <em className="strip-state live">идёт</em>
              ) : doneIds.includes(slide.id) ? (
                <em className="strip-state">
                  <Check size={14} aria-hidden="true" /> показан
                </em>
              ) : null}
            </button>
          );
        })}
      </div>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
