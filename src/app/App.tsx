import { useEffect, useState } from 'react';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import AdminPage from '../pages/AdminPage';
import ParticipantPage from '../pages/ParticipantPage';
import ProjectorPage from '../pages/ProjectorPage';
import {
  AppScreen,
  OpenAnswersResponse,
  Participant,
  PulseResponse,
  Session,
  SessionResponse,
  SessionSlide,
  WordCloudResponse,
} from '../shared/types/common';
import { APP_STORAGE_KEY, APP_TITLE } from '../shared/lib/constants';
import { defaultSession, findSlideById } from '../shared/lib/session';
import { OpenAnswer } from '../features/open-answers/model/types';
import { sortAnswersByLikes } from '../features/open-answers/model/utils';
import { WordCloudItem } from '../features/word-cloud/model/types';
import { mergeParticipantWord } from '../features/word-cloud/model/utils';
import { PulseDistribution } from '../features/pulse/model/types';
import { createId } from '../shared/lib/ids';
import { auth } from '../shared/lib/firebase';
import { ensureSessionDocument, saveSessionDocument, subscribeToSession } from '../shared/lib/firestoreSessions';
import { saveParticipant, subscribeToParticipants } from '../shared/lib/firestoreParticipants';
import { saveResponse, subscribeToResponses } from '../shared/lib/firestoreResponses';

const answerColors = [
  'linear-gradient(135deg, rgba(51,99,193,0.42), rgba(49,65,123,0.18))',
  'linear-gradient(135deg, rgba(111,114,196,0.42), rgba(49,65,123,0.18))',
  'linear-gradient(135deg, rgba(71,157,219,0.38), rgba(10,10,33,0.22))',
  'linear-gradient(135deg, rgba(255,255,255,0.18), rgba(255,255,255,0.04))',
];

type PersistedAppState = {
  screen: AppScreen;
  session: Session;
  participants: Participant[];
  activeParticipantId: string | null;
  isFrozen: boolean;
  responses: SessionResponse[];
  likedIds: string[];
  answerLikes: Record<string, number>;
  focusedAnswerId: string | null;
};

function readLaunchState() {
  if (typeof window === 'undefined') {
    return {
      screen: null as AppScreen | null,
      joinCodeDraft: '',
    };
  }

  const path = window.location.pathname.toLowerCase();
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code')?.toUpperCase() ?? '';

  if (path.includes('/participant')) {
    return {
      screen: 'participant' as AppScreen,
      joinCodeDraft: code,
    };
  }

  if (path.includes('/projector')) {
    return {
      screen: 'projector' as AppScreen,
      joinCodeDraft: code,
    };
  }

  return {
    screen: null as AppScreen | null,
    joinCodeDraft: code,
  };
}

function loadPersistedAppState(): PersistedAppState {
  const fallback: PersistedAppState = {
    screen: 'admin',
    session: defaultSession,
    participants: [],
    activeParticipantId: null,
    isFrozen: false,
    responses: [],
    likedIds: [],
    answerLikes: {},
    focusedAnswerId: null,
  };

  if (typeof window === 'undefined') {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(APP_STORAGE_KEY);
    const launch = readLaunchState();

    if (!raw) {
      return {
        ...fallback,
        screen: launch.screen ?? fallback.screen,
      };
    }

    const parsed = JSON.parse(raw) as Partial<PersistedAppState>;

    if (!parsed.session || !Array.isArray(parsed.session.slides)) {
      return fallback;
    }

    return {
      screen: launch.screen ?? (parsed.screen === 'participant' || parsed.screen === 'projector' ? parsed.screen : 'admin'),
      session: parsed.session,
      participants: Array.isArray(parsed.participants) ? parsed.participants : [],
      activeParticipantId: typeof parsed.activeParticipantId === 'string' ? parsed.activeParticipantId : null,
      isFrozen: Boolean(parsed.isFrozen),
      responses: Array.isArray(parsed.responses) ? parsed.responses : [],
      likedIds: Array.isArray(parsed.likedIds) ? parsed.likedIds : [],
      answerLikes: parsed.answerLikes ?? {},
      focusedAnswerId: typeof parsed.focusedAnswerId === 'string' ? parsed.focusedAnswerId : null,
    };
  } catch {
    return fallback;
  }
}

function getFirebaseErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) {
    return `${fallback} ${error.message}`;
  }

  if (typeof error === 'string' && error.trim()) {
    return `${fallback} ${error}`;
  }

  return fallback;
}

export default function App() {
  const [initialState] = useState(loadPersistedAppState);
  const [launchState] = useState(readLaunchState);
  const [screen, setScreen] = useState<AppScreen>(initialState.screen);
  const [session, setSession] = useState<Session>(initialState.session);
  const [participants, setParticipants] = useState<Participant[]>(initialState.participants);
  const [activeParticipantId, setActiveParticipantId] = useState<string | null>(initialState.activeParticipantId);
  const [participantNameDraft, setParticipantNameDraft] = useState('');
  const [joinCodeDraft, setJoinCodeDraft] = useState(launchState.joinCodeDraft);
  const [joinError, setJoinError] = useState('');
  const [isFrozen, setIsFrozen] = useState(initialState.isFrozen);
  const [mcParticipantVote, setMcParticipantVote] = useState<number | null>(null);
  const [responses, setResponses] = useState<SessionResponse[]>(initialState.responses);
  const [participantPhrase, setParticipantPhrase] = useState('');
  const [likedIds, setLikedIds] = useState<string[]>(initialState.likedIds);
  const [answerLikes, setAnswerLikes] = useState<Record<string, number>>(initialState.answerLikes);
  const [focusedAnswerId, setFocusedAnswerId] = useState<string | null>(initialState.focusedAnswerId);
  const [editingAnswerId, setEditingAnswerId] = useState<string | null>(null);
  const [draftAnswerText, setDraftAnswerText] = useState('');
  const [pulseParticipantValue, setPulseParticipantValue] = useState(5);
  const [cloudParticipantWord, setCloudParticipantWord] = useState('');
  const [authUid, setAuthUid] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState('');
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionError, setSessionError] = useState('');
  const [participantsReady, setParticipantsReady] = useState(false);
  const [participantsError, setParticipantsError] = useState('');
  const [responsesReady, setResponsesReady] = useState(false);
  const [responsesError, setResponsesError] = useState('');

  const currentSlide = findSlideById(session.slides, session.currentSlideId);
  const liveSlide = findSlideById(session.slides, session.liveSlideId);

  const currentMultipleChoiceSlide = currentSlide?.type === 'multiple-choice' ? currentSlide : null;
  const liveMultipleChoiceSlide = liveSlide?.type === 'multiple-choice' ? liveSlide : null;
  const currentOpenAnswersSlide = currentSlide?.type === 'open-answers' ? currentSlide : null;
  const liveOpenAnswersSlide = liveSlide?.type === 'open-answers' ? liveSlide : null;
  const currentPulseSlide = currentSlide?.type === 'pulse' ? currentSlide : null;
  const livePulseSlide = liveSlide?.type === 'pulse' ? liveSlide : null;
  const currentWordCloudSlide = currentSlide?.type === 'word-cloud' ? currentSlide : null;
  const liveWordCloudSlide = liveSlide?.type === 'word-cloud' ? liveSlide : null;
  const activeParticipant = participants.find((participant) => participant.id === activeParticipantId) ?? null;

  function updateSlide(slideId: string, updater: (slide: SessionSlide) => SessionSlide) {
    setSession((currentSession) => ({
      ...currentSession,
      slides: currentSession.slides.map((slide) => (slide.id === slideId ? updater(slide) : slide)),
    }));
  }

  function buildOpenAnswers(slideId: string | null): OpenAnswer[] {
    if (!slideId) {
      return [];
    }

    const answers = responses
      .filter(
        (response): response is OpenAnswersResponse =>
          response.slideId === slideId && response.type === 'open-answers',
      )
      .map((response, index) => ({
        id: response.id,
        text: response.value,
        likes: answerLikes[response.id] ?? 0,
        color: answerColors[index % answerColors.length],
      }));

    return sortAnswersByLikes(answers);
  }

  function buildPulseDistribution(slideId: string | null): PulseDistribution {
    const distribution: PulseDistribution = {
      1: 0, 2: 0, 3: 0, 4: 0, 5: 0,
      6: 0, 7: 0, 8: 0, 9: 0, 10: 0,
    };

    if (!slideId) {
      return distribution;
    }

    responses
      .filter(
        (response): response is PulseResponse =>
          response.slideId === slideId && response.type === 'pulse',
      )
      .forEach((response) => {
        distribution[response.value] = (distribution[response.value] ?? 0) + 1;
      });

    return distribution;
  }

  function buildWordCloudWords(slideId: string | null, useAI: boolean): WordCloudItem[] {
    if (!slideId) {
      return [];
    }

    return responses
      .filter(
        (response): response is WordCloudResponse =>
          response.slideId === slideId && response.type === 'word-cloud',
      )
      .reduce<WordCloudItem[]>((words, response) => mergeParticipantWord(words, response.value, useAI), []);
  }

  function buildMultipleChoiceOptions(slide: typeof currentMultipleChoiceSlide) {
    if (!slide) {
      return [];
    }

    const slideResponses = responses.filter(
      (response) => response.slideId === slide.id && response.type === 'multiple-choice',
    );

    return slide.options.map((option) => ({
      ...option,
      votes: slideResponses.filter((response) => response.value === option.id).length,
    }));
  }

  async function upsertSingleResponse(
    slideId: string,
    type: SessionResponse['type'],
    value: string | number,
  ) {
    if (!activeParticipantId) {
      return;
    }

    const existing = responses.find(
      (response) =>
        response.sessionId === session.id &&
        response.slideId === slideId &&
        response.participantId === activeParticipantId &&
        response.type === type,
    );

    const nextResponse: SessionResponse = existing
      ? ({ ...existing, value } as SessionResponse)
      : ({
          id: createId('response'),
          sessionId: session.id,
          slideId,
          participantId: activeParticipantId,
          type,
          value: value as never,
          createdAt: new Date().toISOString(),
        } as SessionResponse);

    await saveResponse(session.id, nextResponse);
  }

  async function handleVoteSubmit() {
    if (!mcParticipantVote || !liveMultipleChoiceSlide || !activeParticipantId) {
      return;
    }

    await upsertSingleResponse(liveMultipleChoiceSlide.id, 'multiple-choice', mcParticipantVote);
  }

  async function handleOpenAnswerSubmit() {
    if (!participantPhrase.trim() || !liveOpenAnswersSlide || !activeParticipantId) {
      return;
    }

    await saveResponse(session.id, {
      id: createId('response'),
      sessionId: session.id,
      slideId: liveOpenAnswersSlide.id,
      participantId: activeParticipantId,
      type: 'open-answers',
      value: participantPhrase.trim(),
      createdAt: new Date().toISOString(),
    });
    setParticipantPhrase('');
  }

  function handleToggleLike(id: string) {
    if (!liveOpenAnswersSlide?.allowLikes) {
      return;
    }

    const isLiked = likedIds.includes(id);
    setLikedIds((current) => (isLiked ? current.filter((value) => value !== id) : [...current, id]));
    setAnswerLikes((current) => ({
      ...current,
      [id]: Math.max((current[id] ?? 0) + (isLiked ? -1 : 1), 0),
    }));
  }

  function startEditingAnswer(answer: OpenAnswer) {
    setEditingAnswerId(answer.id);
    setDraftAnswerText(answer.text);
  }

  async function saveEditingAnswer(id: string) {
    const response = responses.find(
      (item) => item.id === id && item.type === 'open-answers',
    );

    if (!response || response.type !== 'open-answers') {
      return;
    }

    await saveResponse(session.id, {
      ...response,
      value: draftAnswerText.trim() || draftAnswerText,
    });
    setEditingAnswerId(null);
    setDraftAnswerText('');
  }

  async function addParticipant() {
    const nextParticipant: Participant = {
      id: createId('participant'),
      name: `Участник ${participants.length + 1}`,
    };

    try {
      await saveParticipant(session.id, nextParticipant);
      setActiveParticipantId(nextParticipant.id);
    } catch (error) {
      setParticipantsError(getFirebaseErrorMessage(error, 'Не удалось добавить участника в Firestore.'));
    }
  }

  async function joinParticipant() {
    const name = participantNameDraft.trim();
    const code = joinCodeDraft.trim().toUpperCase();

    if (!name) {
      setJoinError('Введите имя участника.');
      return;
    }

    if (code !== session.joinCode) {
      setJoinError('Неверный код подключения.');
      return;
    }

    const nextParticipant: Participant = {
      id: createId('participant'),
      name,
    };

    try {
      await saveParticipant(session.id, nextParticipant);
      setActiveParticipantId(nextParticipant.id);
      setParticipantNameDraft('');
      setJoinCodeDraft('');
      setJoinError('');
    } catch (error) {
      setJoinError(getFirebaseErrorMessage(error, 'Не удалось зарегистрировать участника в Firestore.'));
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setAuthUid(user.uid);
        setAuthError('');
        setAuthReady(true);
        return;
      }

      try {
        const credentials = await signInAnonymously(auth);
        setAuthUid(credentials.user.uid);
        setAuthError('');
      } catch (error) {
        setAuthUid(null);
        setAuthError(getFirebaseErrorMessage(error, 'Не удалось подключиться к Firebase. Проверьте настройки проекта.'));
      } finally {
        setAuthReady(true);
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!authUid) {
      return;
    }

    const ownerUid = authUid;
    let isActive = true;

    async function setupSessionSync() {
      try {
        setSessionReady(false);
        await ensureSessionDocument(session, ownerUid);

        const unsubscribe = subscribeToSession(
          session.id,
          (nextSession) => {
            if (!isActive) {
              return;
            }

            setSession(nextSession);
            setSessionReady(true);
            setSessionError('');
          },
          (error) => {
            if (!isActive) {
              return;
            }

            setSessionError(getFirebaseErrorMessage(error, 'Не удалось получить живую сессию из Firestore.'));
          },
        );

        return unsubscribe;
      } catch (error) {
        if (isActive) {
          setSessionError(getFirebaseErrorMessage(error, 'Не удалось создать документ сессии в Firestore.'));
        }

        return undefined;
      }
    }

    let cleanup: VoidFunction | undefined;

    setupSessionSync().then((unsubscribe) => {
      cleanup = unsubscribe;
    });

    return () => {
      isActive = false;
      cleanup?.();
    };
  }, [authUid]);

  useEffect(() => {
    if (!authUid || !sessionReady) {
      return;
    }

    saveSessionDocument(session, authUid).catch((error) => {
      setSessionError(getFirebaseErrorMessage(error, 'Не удалось сохранить изменения сессии в Firestore.'));
    });
  }, [session, authUid, sessionReady]);

  useEffect(() => {
    if (!sessionReady) {
      return;
    }

    setParticipantsReady(false);

    const unsubscribe = subscribeToParticipants(
      session.id,
      (nextParticipants) => {
        setParticipants(nextParticipants);
        setParticipantsReady(true);
        setParticipantsError('');
      },
      (error) => {
        setParticipantsError(getFirebaseErrorMessage(error, 'Не удалось получить список участников из Firestore.'));
      },
    );

    return unsubscribe;
  }, [session.id, sessionReady]);

  useEffect(() => {
    if (!sessionReady) {
      return;
    }

    setResponsesReady(false);

    const unsubscribe = subscribeToResponses(
      session.id,
      (nextResponses) => {
        setResponses(nextResponses);
        setResponsesReady(true);
        setResponsesError('');
      },
      (error) => {
        setResponsesError(getFirebaseErrorMessage(error, 'Не удалось получить ответы из Firestore.'));
      },
    );

    return unsubscribe;
  }, [session.id, sessionReady]);

  useEffect(() => {
    if (!activeParticipantId) {
      setMcParticipantVote(null);
      setPulseParticipantValue(5);
      setCloudParticipantWord('');
      setParticipantPhrase('');
      return;
    }

    const activeMcResponse =
      liveMultipleChoiceSlide
        ? responses.find(
            (response) =>
              response.slideId === liveMultipleChoiceSlide.id &&
              response.type === 'multiple-choice' &&
              response.participantId === activeParticipantId,
          )
        : null;

    setMcParticipantVote(activeMcResponse && activeMcResponse.type === 'multiple-choice' ? activeMcResponse.value : null);

    const activePulseResponse =
      livePulseSlide
        ? responses.find(
            (response) =>
              response.slideId === livePulseSlide.id &&
              response.type === 'pulse' &&
              response.participantId === activeParticipantId,
          )
        : null;

    setPulseParticipantValue(activePulseResponse && activePulseResponse.type === 'pulse' ? activePulseResponse.value : 5);

    const activeCloudResponse =
      liveWordCloudSlide
        ? responses.find(
            (response) =>
              response.slideId === liveWordCloudSlide.id &&
              response.type === 'word-cloud' &&
              response.participantId === activeParticipantId,
          )
        : null;

    setCloudParticipantWord(activeCloudResponse && activeCloudResponse.type === 'word-cloud' ? activeCloudResponse.value : '');
    setParticipantPhrase('');
  }, [activeParticipantId, liveMultipleChoiceSlide, livePulseSlide, liveWordCloudSlide, responses]);

  useEffect(() => {
    window.localStorage.setItem(
      APP_STORAGE_KEY,
      JSON.stringify({
        screen,
        session,
        participants,
        activeParticipantId,
        isFrozen,
        responses,
        likedIds,
        answerLikes,
        focusedAnswerId,
      } satisfies PersistedAppState),
    );
  }, [screen, session, participants, activeParticipantId, isFrozen, responses, likedIds, answerLikes, focusedAnswerId]);

  const currentOpenAnswers = buildOpenAnswers(currentOpenAnswersSlide?.id ?? null);
  const liveOpenAnswers = buildOpenAnswers(liveOpenAnswersSlide?.id ?? null);
  const currentPulseDistribution = buildPulseDistribution(currentPulseSlide?.id ?? null);
  const livePulseDistribution = buildPulseDistribution(livePulseSlide?.id ?? null);
  const currentCloudWords = buildWordCloudWords(currentWordCloudSlide?.id ?? null, currentWordCloudSlide?.useAI ?? true);
  const liveCloudWords = buildWordCloudWords(liveWordCloudSlide?.id ?? null, liveWordCloudSlide?.useAI ?? true);
  const currentMcOptions = buildMultipleChoiceOptions(currentMultipleChoiceSlide);
  const liveMcOptions = buildMultipleChoiceOptions(liveMultipleChoiceSlide);
  const mcHasVoted =
    !!liveMultipleChoiceSlide &&
    responses.some(
      (response) =>
        response.slideId === liveMultipleChoiceSlide.id &&
        response.type === 'multiple-choice' &&
        response.participantId === activeParticipantId,
    );

  if (!authReady) {
    return (
      <div className="page-shell">
        <div className="page-content" style={{ padding: 32 }}>
          <div className="card" style={{ maxWidth: 560, padding: 28 }}>
            <p className="muted" style={{ marginTop: 0 }}>Firebase</p>
            <h1 className="hero-title">Подключаем сессию</h1>
            <p className="hero-text">Приложение получает анонимный доступ к Firebase перед запуском живой сессии.</p>
          </div>
        </div>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="page-shell">
        <div className="page-content" style={{ padding: 32 }}>
          <div className="card" style={{ maxWidth: 640, padding: 28 }}>
            <p className="muted" style={{ marginTop: 0 }}>Firebase</p>
            <h1 className="hero-title">Подключение не удалось</h1>
            <p className="hero-text">{authError}</p>
            <p className="muted" style={{ marginBottom: 0 }}>UID: {authUid ?? 'не получен'}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!sessionReady) {
    return (
      <div className="page-shell">
        <div className="page-content" style={{ padding: 32 }}>
          <div className="card" style={{ maxWidth: 640, padding: 28 }}>
            <p className="muted" style={{ marginTop: 0 }}>Firestore</p>
            <h1 className="hero-title">Подключаем живую сессию</h1>
            <p className="hero-text">
              Готовим общий документ сессии, чтобы пульт ведущего, экран аудитории и участники работали в одном пространстве.
            </p>
            {sessionError && <p style={{ color: '#fda4af', marginBottom: 0 }}>{sessionError}</p>}
          </div>
        </div>
      </div>
    );
  }

  if (!participantsReady && participantsError) {
    return (
      <div className="page-shell">
        <div className="page-content" style={{ padding: 32 }}>
          <div className="card" style={{ maxWidth: 640, padding: 28 }}>
            <p className="muted" style={{ marginTop: 0 }}>Firestore</p>
            <h1 className="hero-title">Участники пока недоступны</h1>
            <p className="hero-text">{participantsError}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!responsesReady && responsesError) {
    return (
      <div className="page-shell">
        <div className="page-content" style={{ padding: 32 }}>
          <div className="card" style={{ maxWidth: 640, padding: 28 }}>
            <p className="muted" style={{ marginTop: 0 }}>Firestore</p>
            <h1 className="hero-title">Ответы пока недоступны</h1>
            <p className="hero-text">{responsesError}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {screen === 'admin' && (
        <AdminPage
          appTitle={APP_TITLE}
          currentScreen={screen}
          session={session}
          currentSlide={currentSlide}
          liveSlide={liveSlide}
          participants={participants}
          isFrozen={isFrozen}
          mcQuestion={currentMultipleChoiceSlide?.title ?? 'Новый опрос'}
          mcOptions={currentMcOptions}
          liveMcQuestion={liveMultipleChoiceSlide?.title ?? 'Опрос'}
          liveMcOptions={liveMcOptions}
          mcParticipantVote={mcParticipantVote}
          mcHasVoted={mcHasVoted}
          mcResultDisplay={currentMultipleChoiceSlide?.resultDisplay ?? 'both'}
          liveMcResultDisplay={liveMultipleChoiceSlide?.resultDisplay ?? 'both'}
          liveMcVisualization={liveMultipleChoiceSlide?.visualization ?? 'bar'}
          openQuestion={currentOpenAnswersSlide?.title ?? 'Новый открытый вопрос'}
          openAnswers={currentOpenAnswers}
          liveOpenQuestion={liveOpenAnswersSlide?.title ?? 'Открытый вопрос'}
          liveOpenAnswers={liveOpenAnswers}
          participantPhrase={participantPhrase}
          allowLikes={currentOpenAnswersSlide?.allowLikes ?? true}
          liveAllowLikes={liveOpenAnswersSlide?.allowLikes ?? true}
          liveOpenVisualization={liveOpenAnswersSlide?.visualization ?? 'cards'}
          likedIds={likedIds}
          focusedAnswerId={focusedAnswerId}
          editingAnswerId={editingAnswerId}
          draftAnswerText={draftAnswerText}
          pulseTitle={currentPulseSlide?.title ?? 'Новый пульс-опрос'}
          livePulseTitle={livePulseSlide?.title ?? 'Пульс аудитории'}
          pulseMinLabel={currentPulseSlide?.minLabel ?? 'Скучно'}
          pulseMaxLabel={currentPulseSlide?.maxLabel ?? 'Огонь!'}
          livePulseMinLabel={livePulseSlide?.minLabel ?? 'Скучно'}
          livePulseMaxLabel={livePulseSlide?.maxLabel ?? 'Огонь!'}
          pulseParticipantValue={pulseParticipantValue}
          pulseProjectorView={currentPulseSlide?.projectorView ?? 'histogram'}
          pulseDistribution={currentPulseDistribution}
          livePulseProjectorView={livePulseSlide?.projectorView ?? 'histogram'}
          livePulseDistribution={livePulseDistribution}
          pulseMetricDisplay={currentPulseSlide?.metricDisplay ?? 'both'}
          livePulseMetricDisplay={livePulseSlide?.metricDisplay ?? 'both'}
          livePulseVisualization={livePulseSlide?.visualization ?? 'bars'}
          cloudTitle={currentWordCloudSlide?.title ?? 'Новое облако слов'}
          liveCloudTitle={liveWordCloudSlide?.title ?? 'Облако слов'}
          cloudParticipantWord={cloudParticipantWord}
          cloudUseAI={currentWordCloudSlide?.useAI ?? true}
          cloudWords={currentCloudWords}
          liveCloudUseAI={liveWordCloudSlide?.useAI ?? true}
          liveCloudWords={liveCloudWords}
          liveCloudVisualization={liveWordCloudSlide?.visualization ?? 'cloud'}
          onFreezeToggle={() => setIsFrozen((value) => !value)}
          onMcQuestionChange={(value) => {
            if (!currentMultipleChoiceSlide) return;
            updateSlide(currentMultipleChoiceSlide.id, (slide) =>
              slide.type === 'multiple-choice' ? { ...slide, title: value } : slide,
            );
          }}
          onMcOptionsChange={(options) => {
            if (!currentMultipleChoiceSlide) return;
            updateSlide(currentMultipleChoiceSlide.id, (slide) =>
              slide.type === 'multiple-choice'
                ? {
                    ...slide,
                    options: options.map((option) => ({
                      ...option,
                      votes: 0,
                    })),
                  }
                : slide,
            );
          }}
          onMcResultDisplayChange={(value) => {
            if (!currentMultipleChoiceSlide) return;
            updateSlide(currentMultipleChoiceSlide.id, (slide) =>
              slide.type === 'multiple-choice' ? { ...slide, resultDisplay: value } : slide,
            );
          }}
          onOpenQuestionChange={(value) => {
            if (!currentSlide) return;
            updateSlide(currentSlide.id, (slide) => ({ ...slide, title: value }));
          }}
          onAllowLikesChange={(value) => {
            if (!currentOpenAnswersSlide) return;
            updateSlide(currentOpenAnswersSlide.id, (slide) =>
              slide.type === 'open-answers' ? { ...slide, allowLikes: value } : slide,
            );
          }}
          onFocusedAnswerChange={setFocusedAnswerId}
          onStartEditingAnswer={startEditingAnswer}
          onDraftAnswerTextChange={setDraftAnswerText}
          onSaveEditingAnswer={saveEditingAnswer}
          onPulseMinLabelChange={(value) => {
            if (!currentPulseSlide) return;
            updateSlide(currentPulseSlide.id, (slide) =>
              slide.type === 'pulse' ? { ...slide, minLabel: value } : slide,
            );
          }}
          onPulseMaxLabelChange={(value) => {
            if (!currentPulseSlide) return;
            updateSlide(currentPulseSlide.id, (slide) =>
              slide.type === 'pulse' ? { ...slide, maxLabel: value } : slide,
            );
          }}
          onPulseParticipantValueChange={(value) => {
            setPulseParticipantValue(value);
            if (livePulseSlide) {
              upsertSingleResponse(livePulseSlide.id, 'pulse', value);
            }
          }}
          onPulseProjectorViewChange={(value) => {
            if (!currentPulseSlide) return;
            updateSlide(currentPulseSlide.id, (slide) =>
              slide.type === 'pulse' ? { ...slide, projectorView: value } : slide,
            );
          }}
          onPulseMetricDisplayChange={(value) => {
            if (!currentPulseSlide) return;
            updateSlide(currentPulseSlide.id, (slide) =>
              slide.type === 'pulse' ? { ...slide, metricDisplay: value } : slide,
            );
          }}
          onCloudParticipantWordChange={(value) => {
            setCloudParticipantWord(value);
            if (liveWordCloudSlide && value.trim()) {
              upsertSingleResponse(liveWordCloudSlide.id, 'word-cloud', value);
            }
          }}
          onCloudUseAIChange={(value) => {
            if (!currentWordCloudSlide) return;
            updateSlide(currentWordCloudSlide.id, (slide) =>
              slide.type === 'word-cloud' ? { ...slide, useAI: value } : slide,
            );
          }}
          onSessionChange={setSession}
          onScreenChange={setScreen}
        />
      )}
      {screen === 'participant' && (
        <ParticipantPage
          appTitle={APP_TITLE}
          participants={participants}
          activeParticipant={activeParticipant}
          joinCode={session.joinCode}
          joinCodeDraft={joinCodeDraft}
          participantNameDraft={participantNameDraft}
          joinError={joinError}
          liveModule={liveSlide?.type ?? null}
          mcOptions={liveMcOptions}
          mcQuestion={liveMultipleChoiceSlide?.title ?? 'Опрос'}
          mcParticipantVote={mcParticipantVote}
          mcHasVoted={mcHasVoted}
          openQuestion={liveOpenAnswersSlide?.title ?? 'Открытый вопрос'}
          openAnswers={liveOpenAnswers}
          participantPhrase={participantPhrase}
          stickersUsed={liveOpenAnswers.length}
          allowLikes={liveOpenAnswersSlide?.allowLikes ?? true}
          likedIds={likedIds}
          pulseTitle={livePulseSlide?.title ?? 'Пульс аудитории'}
          pulseMinLabel={livePulseSlide?.minLabel ?? 'Скучно'}
          pulseMaxLabel={livePulseSlide?.maxLabel ?? 'Огонь!'}
          pulseParticipantValue={pulseParticipantValue}
          cloudTitle={liveWordCloudSlide?.title ?? 'Облако слов'}
          cloudParticipantWord={cloudParticipantWord}
          cloudUseAI={liveWordCloudSlide?.useAI ?? true}
          cloudWords={liveCloudWords}
          onMcParticipantVoteChange={setMcParticipantVote}
          onMcResetVote={() => {
            setMcParticipantVote(null);
          }}
          onMcSubmit={handleVoteSubmit}
          onParticipantPhraseChange={setParticipantPhrase}
          onOpenSubmit={handleOpenAnswerSubmit}
          onOpenLikeToggle={handleToggleLike}
          onPulseParticipantValueChange={(value) => {
            setPulseParticipantValue(value);
            if (livePulseSlide) {
              upsertSingleResponse(livePulseSlide.id, 'pulse', value);
            }
          }}
          onCloudParticipantWordChange={(value) => {
            setCloudParticipantWord(value);
            if (liveWordCloudSlide && value.trim()) {
              upsertSingleResponse(liveWordCloudSlide.id, 'word-cloud', value);
            }
          }}
          onActiveParticipantChange={(participantId) => {
            setActiveParticipantId(participantId);
            setJoinError('');
          }}
          onAddParticipant={addParticipant}
          onJoinCodeDraftChange={setJoinCodeDraft}
          onParticipantNameDraftChange={setParticipantNameDraft}
          onJoinSession={joinParticipant}
          onScreenChange={setScreen}
        />
      )}
      {screen === 'projector' && (
        <ProjectorPage
          appTitle={APP_TITLE}
          liveModule={liveSlide?.type ?? null}
          isFrozen={isFrozen}
          mcQuestion={liveMultipleChoiceSlide?.title ?? 'Опрос'}
          mcOptions={liveMcOptions}
          mcVisualization={liveMultipleChoiceSlide?.visualization ?? 'bar'}
          mcResultDisplay={liveMultipleChoiceSlide?.resultDisplay ?? 'both'}
          openQuestion={liveOpenAnswersSlide?.title ?? 'Открытый вопрос'}
          openAnswers={liveOpenAnswers}
          focusedAnswerId={focusedAnswerId}
          openVisualization={liveOpenAnswersSlide?.visualization ?? 'cards'}
          pulseTitle={livePulseSlide?.title ?? 'Пульс аудитории'}
          pulseMinLabel={livePulseSlide?.minLabel ?? 'Скучно'}
          pulseMaxLabel={livePulseSlide?.maxLabel ?? 'Огонь!'}
          pulseParticipantValue={pulseParticipantValue}
          pulseProjectorView={livePulseSlide?.projectorView ?? 'histogram'}
          pulseDistribution={livePulseDistribution}
          pulseVisualization={livePulseSlide?.visualization ?? 'bars'}
          pulseMetricDisplay={livePulseSlide?.metricDisplay ?? 'both'}
          cloudTitle={liveWordCloudSlide?.title ?? 'Облако слов'}
          cloudWords={liveCloudWords}
          cloudParticipantWord={cloudParticipantWord}
          cloudVisualization={liveWordCloudSlide?.visualization ?? 'cloud'}
          onFocusedAnswerChange={setFocusedAnswerId}
          onScreenChange={setScreen}
        />
      )}
    </>
  );
}
