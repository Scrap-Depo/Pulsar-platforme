import { useEffect, useState } from 'react';
import { BarChart3, ChevronLeft, ChevronRight, Cloud, Copy, LayoutDashboard, Link2, MessageCircleMore, MonitorPlay, RefreshCw, SkipBack, SkipForward, Waves } from 'lucide-react';
import MultipleChoiceAdmin from '../features/multiple-choice/components/MultipleChoiceAdmin';
import MultipleChoiceParticipant from '../features/multiple-choice/components/MultipleChoiceParticipant';
import MultipleChoiceProjector from '../features/multiple-choice/components/MultipleChoiceProjector';
import OpenAnswersAdmin from '../features/open-answers/components/OpenAnswersAdmin';
import OpenAnswersParticipant from '../features/open-answers/components/OpenAnswersParticipant';
import OpenAnswersProjector from '../features/open-answers/components/OpenAnswersProjector';
import PulseAdmin from '../features/pulse/components/PulseAdmin';
import PulseParticipant from '../features/pulse/components/PulseParticipant';
import PulseProjector from '../features/pulse/components/PulseProjector';
import WordCloudAdmin from '../features/word-cloud/components/WordCloudAdmin';
import WordCloudParticipant from '../features/word-cloud/components/WordCloudParticipant';
import WordCloudProjector from '../features/word-cloud/components/WordCloudProjector';
import FreezeOverlay from '../widgets/controls/FreezeOverlay';
import AdminShell from '../widgets/layout/AdminShell';
import Button from '../shared/ui/Button';
import { AppScreen, MultipleChoiceVisualization, OpenAnswersVisualization, PulseVisualization, Session, SessionSlide, SlideType, WordCloudVisualization } from '../shared/types/common';
import { createSlide, createTemplateSlide, duplicateSlide, removeSlide, reorderSlides, slideTemplates } from '../shared/lib/session';
import { MultipleChoiceOption } from '../features/multiple-choice/model/types';
import { OpenAnswer } from '../features/open-answers/model/types';
import { PulseDistribution, PulseProjectorView } from '../features/pulse/model/types';
import { WordCloudItem } from '../features/word-cloud/model/types';

type AdminPageProps = {
  appTitle: string;
  currentScreen: AppScreen;
  session: Session;
  currentSlide: SessionSlide | null;
  liveSlide: SessionSlide | null;
  audienceCount: number;
  isFrozen: boolean;
  mcQuestion: string;
  mcOptions: MultipleChoiceOption[];
  liveMcQuestion: string;
  liveMcOptions: MultipleChoiceOption[];
  mcParticipantVote: number | null;
  mcHasVoted: boolean;
  mcResultDisplay: 'percent' | 'votes' | 'both';
  liveMcResultDisplay: 'percent' | 'votes' | 'both';
  liveMcVisualization: MultipleChoiceVisualization;
  openQuestion: string;
  openAnswers: OpenAnswer[];
  liveOpenQuestion: string;
  liveOpenAnswers: OpenAnswer[];
  participantPhrase: string;
  allowLikes: boolean;
  liveAllowLikes: boolean;
  liveOpenVisualization: OpenAnswersVisualization;
  likedIds: string[];
  focusedAnswerId: string | null;
  editingAnswerId: string | null;
  draftAnswerText: string;
  pulseTitle: string;
  livePulseTitle: string;
  pulseMinLabel: string;
  pulseMaxLabel: string;
  livePulseMinLabel: string;
  livePulseMaxLabel: string;
  pulseParticipantValue: number;
  pulseProjectorView: PulseProjectorView;
  pulseDistribution: PulseDistribution;
  livePulseProjectorView: PulseProjectorView;
  livePulseDistribution: PulseDistribution;
  pulseMetricDisplay: 'average' | 'participant' | 'both';
  livePulseMetricDisplay: 'average' | 'participant' | 'both';
  livePulseVisualization: PulseVisualization;
  cloudTitle: string;
  liveCloudTitle: string;
  cloudParticipantWord: string;
  cloudUseAI: boolean;
  cloudWords: WordCloudItem[];
  liveCloudUseAI: boolean;
  liveCloudWords: WordCloudItem[];
  liveCloudVisualization: WordCloudVisualization;
  onFreezeToggle: () => void;
  onMcQuestionChange: (value: string) => void;
  onMcOptionsChange: (options: MultipleChoiceOption[]) => void;
  onMcResultDisplayChange: (value: 'percent' | 'votes' | 'both') => void;
  onOpenQuestionChange: (value: string) => void;
  onAllowLikesChange: (value: boolean) => void;
  onFocusedAnswerChange: (id: string | null) => void;
  onStartEditingAnswer: (answer: OpenAnswer) => void;
  onDraftAnswerTextChange: (value: string) => void;
  onSaveEditingAnswer: (id: string) => void;
  onPulseMinLabelChange: (value: string) => void;
  onPulseMaxLabelChange: (value: string) => void;
  onPulseParticipantValueChange: (value: number) => void;
  onPulseProjectorViewChange: (value: PulseProjectorView) => void;
  onPulseMetricDisplayChange: (value: 'average' | 'participant' | 'both') => void;
  onCloudParticipantWordChange: (value: string) => void;
  onCloudUseAIChange: (value: boolean) => void;
  onSessionChange: (session: Session) => void;
  onPublishLiveSlide: (slideId: string) => void;
  onLaunchAudienceScreen: () => void;
};

export default function AdminPage({
  appTitle,
  session,
  currentSlide,
  liveSlide,
  audienceCount,
  isFrozen,
  mcQuestion,
  mcOptions,
  liveMcQuestion,
  liveMcOptions,
  mcParticipantVote,
  mcHasVoted,
  mcResultDisplay,
  liveMcResultDisplay,
  liveMcVisualization,
  openQuestion,
  openAnswers,
  liveOpenQuestion,
  liveOpenAnswers,
  participantPhrase,
  allowLikes,
  liveAllowLikes,
  liveOpenVisualization,
  likedIds,
  focusedAnswerId,
  editingAnswerId,
  draftAnswerText,
  pulseTitle,
  livePulseTitle,
  pulseMinLabel,
  pulseMaxLabel,
  livePulseMinLabel,
  livePulseMaxLabel,
  pulseParticipantValue,
  pulseProjectorView,
  pulseDistribution,
  livePulseProjectorView,
  livePulseDistribution,
  pulseMetricDisplay,
  livePulseMetricDisplay,
  livePulseVisualization,
  cloudTitle,
  liveCloudTitle,
  cloudParticipantWord,
  cloudUseAI,
  cloudWords,
  liveCloudUseAI,
  liveCloudWords,
  liveCloudVisualization,
  onFreezeToggle,
  onMcQuestionChange,
  onMcOptionsChange,
  onMcResultDisplayChange,
  onOpenQuestionChange,
  onAllowLikesChange,
  onFocusedAnswerChange,
  onStartEditingAnswer,
  onDraftAnswerTextChange,
  onSaveEditingAnswer,
  onPulseMinLabelChange,
  onPulseMaxLabelChange,
  onPulseParticipantValueChange,
  onPulseProjectorViewChange,
  onPulseMetricDisplayChange,
  onCloudParticipantWordChange,
  onCloudUseAIChange,
  onSessionChange,
  onPublishLiveSlide,
  onLaunchAudienceScreen,
}: AdminPageProps) {
  const [isCreateSlideModalOpen, setIsCreateSlideModalOpen] = useState(false);
  const [qrVersion, setQrVersion] = useState(0);
  const [copiedState, setCopiedState] = useState<'idle' | 'done'>('idle');

  function createJoinCode() {
    return `PULSAR${Math.floor(1000 + Math.random() * 9000)}`;
  }

  const joinLink =
    typeof window === 'undefined'
      ? `https://pulsar.local/join/${session.joinCode}`
      : `${window.location.origin}/participant?code=${session.joinCode}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=168x168&data=${encodeURIComponent(joinLink)}&cache=${encodeURIComponent(`${session.joinCode}-${qrVersion}`)}`;
  const moduleMeta: Record<SlideType, { eyebrow: string; title: string; summary: string }> = {
    'multiple-choice': {
      eyebrow: 'Голосование',
      title: 'Голосование',
      summary: 'Вопрос, варианты и вид результата на экране.',
    },
    'open-answers': {
      eyebrow: 'Открытые ответы',
      title: 'Открытые ответы',
      summary: 'Свободные ответы, лайки и вывод сильных реплик.',
    },
    pulse: {
      eyebrow: 'Пульс',
      title: 'Пульс',
      summary: 'Быстрый замер состояния, энергии или понятности.',
    },
    'word-cloud': {
      eyebrow: 'Облако слов',
      title: 'Облако слов',
      summary: 'Короткие ассоциации и темы в общем облаке.',
    },
  };
  const createSlideOptions: Array<{
    type: SlideType;
    group: 'Выбор из готовых вариантов' | 'Свободные ответы своими словами';
    title: string;
    description: string;
    icon: JSX.Element;
  }> = [
    {
      type: 'multiple-choice',
      group: 'Выбор из готовых вариантов',
      title: 'Быстрый выбор',
      description: 'Приоритет, решение или голосование по вариантам.',
      icon: <BarChart3 size={18} />,
    },
    {
      type: 'pulse',
      group: 'Выбор из готовых вариантов',
      title: 'Пульс аудитории',
      description: 'Быстрый замер состояния, энергии или понятности.',
      icon: <Waves size={18} />,
    },
    {
      type: 'open-answers',
      group: 'Свободные ответы своими словами',
      title: 'Короткие мнения',
      description: 'Мысли, идеи и инсайты своими словами.',
      icon: <MessageCircleMore size={18} />,
    },
    {
      type: 'word-cloud',
      group: 'Свободные ответы своими словами',
      title: 'Слова и ассоциации',
      description: 'Ассоциации, темы и общее поле смыслов.',
      icon: <Cloud size={18} />,
    },
  ];
  const slideChoiceGroups = [
    'Выбор из готовых вариантов',
    'Свободные ответы своими словами',
  ] as const;
  useEffect(() => {
    setQrVersion((value) => value + 1);
  }, [session.joinCode]);

  useEffect(() => {
    if (copiedState !== 'done') {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setCopiedState('idle');
    }, 1400);

    return () => window.clearTimeout(timeoutId);
  }, [copiedState]);

  const currentSlideType = currentSlide?.type ?? 'multiple-choice';
  const presentationSlide = liveSlide ?? currentSlide;
  const presentationIndex = presentationSlide
    ? session.slides.findIndex((slide) => slide.id === presentationSlide.id)
    : -1;
  const previousPresentationSlide = presentationIndex > 0 ? session.slides[presentationIndex - 1] : null;
  const nextPresentationSlide =
    presentationIndex >= 0 && presentationIndex < session.slides.length - 1
      ? session.slides[presentationIndex + 1]
      : null;

  const activeModuleEditor = {
    'multiple-choice': (
      <MultipleChoiceAdmin
        question={mcQuestion}
        options={mcOptions}
        visualization={currentSlide?.type === 'multiple-choice' ? currentSlide.visualization : 'bar'}
        resultDisplay={mcResultDisplay}
        onQuestionChange={onMcQuestionChange}
        onOptionsChange={onMcOptionsChange}
        onVisualizationChange={(value) => handleVisualizationChange(value)}
        onResultDisplayChange={onMcResultDisplayChange}
      />
    ),
    'open-answers': (
      <OpenAnswersAdmin
        question={openQuestion}
        answers={openAnswers}
        allowLikes={allowLikes}
        visualization={currentSlide?.type === 'open-answers' ? currentSlide.visualization : 'cards'}
        focusedAnswerId={focusedAnswerId}
        editingAnswerId={editingAnswerId}
        draftAnswerText={draftAnswerText}
        onQuestionChange={onOpenQuestionChange}
        onAllowLikesChange={onAllowLikesChange}
        onVisualizationChange={(value) => handleVisualizationChange(value)}
        onFocusedAnswerChange={onFocusedAnswerChange}
        onStartEditing={onStartEditingAnswer}
        onDraftAnswerTextChange={onDraftAnswerTextChange}
        onSaveEditing={onSaveEditingAnswer}
      />
    ),
    pulse: (
      <PulseAdmin
        title={pulseTitle}
        minLabel={pulseMinLabel}
        maxLabel={pulseMaxLabel}
        participantValue={pulseParticipantValue}
        projectorView={pulseProjectorView}
        visualization={currentSlide?.type === 'pulse' ? currentSlide.visualization : 'bars'}
        metricDisplay={pulseMetricDisplay}
        onTitleChange={onOpenQuestionChange}
        onMinLabelChange={onPulseMinLabelChange}
        onMaxLabelChange={onPulseMaxLabelChange}
        onParticipantValueChange={onPulseParticipantValueChange}
        onProjectorViewChange={onPulseProjectorViewChange}
        onVisualizationChange={(value) => handleVisualizationChange(value)}
        onMetricDisplayChange={onPulseMetricDisplayChange}
      />
    ),
    'word-cloud': (
      <WordCloudAdmin
        title={cloudTitle}
        participantWord={cloudParticipantWord}
        useAI={cloudUseAI}
        visualization={currentSlide?.type === 'word-cloud' ? currentSlide.visualization : 'cloud'}
        onTitleChange={onOpenQuestionChange}
        onParticipantWordChange={onCloudParticipantWordChange}
        onUseAIChange={onCloudUseAIChange}
        onVisualizationChange={(value) => handleVisualizationChange(value)}
      />
    ),
  }[currentSlideType];

  const activeMeta = moduleMeta[currentSlideType];

  const liveParticipantPreview = !liveSlide ? (
    <div className="placeholder-box card" style={{ minHeight: 220 }}>
      <p className="muted">Участник</p>
      <strong>Сейчас ничего не в эфире</strong>
      <p className="hero-text">Когда ведущий выведет слайд в эфир, здесь появится экран телефона.</p>
    </div>
  ) : {
    'multiple-choice': (
      <MultipleChoiceParticipant
        question={liveMcQuestion}
        options={liveMcOptions}
        participantVote={mcParticipantVote}
        hasVoted={mcHasVoted}
        onVoteChange={() => {}}
        onReset={() => {}}
        onSubmit={() => {}}
      />
    ),
    'open-answers': (
      <OpenAnswersParticipant
        question={liveOpenQuestion}
        answers={liveOpenAnswers}
        participantPhrase={participantPhrase}
        stickersUsed={liveOpenAnswers.length}
        allowLikes={liveAllowLikes}
        likedIds={likedIds}
        onPhraseChange={() => {}}
        onSubmit={() => {}}
        onToggleLike={() => {}}
      />
    ),
    pulse: (
      <PulseParticipant
        title={livePulseTitle}
        minLabel={livePulseMinLabel}
        maxLabel={livePulseMaxLabel}
        value={pulseParticipantValue}
        onValueChange={() => {}}
      />
    ),
    'word-cloud': (
      <WordCloudParticipant
        title={liveCloudTitle}
        participantWord={cloudParticipantWord}
        useAI={liveCloudUseAI}
        words={liveCloudWords}
        onParticipantWordChange={() => {}}
      />
    ),
  }[liveSlide.type];

  const projectorPreview = {
    'multiple-choice': (
      <MultipleChoiceProjector
        question={mcQuestion}
        options={mcOptions}
        visualization={currentSlide?.type === 'multiple-choice' ? currentSlide.visualization : 'bar'}
        resultDisplay={mcResultDisplay}
        compact
      />
    ),
    'open-answers': (
      <OpenAnswersProjector
        question={openQuestion}
        answers={openAnswers}
        focusedAnswerId={focusedAnswerId}
        onFocusedAnswerChange={onFocusedAnswerChange}
        visualization={currentSlide?.type === 'open-answers' ? currentSlide.visualization : 'cards'}
      />
    ),
    pulse: (
      <PulseProjector
        title={pulseTitle}
        minLabel={pulseMinLabel}
        maxLabel={pulseMaxLabel}
        value={pulseParticipantValue}
        projectorView={pulseProjectorView}
        distribution={pulseDistribution}
        visualization={currentSlide?.type === 'pulse' ? currentSlide.visualization : 'bars'}
        metricDisplay={pulseMetricDisplay}
        compact
      />
    ),
    'word-cloud': (
      <WordCloudProjector
        title={cloudTitle}
        words={cloudWords}
        participantWord={cloudParticipantWord}
        visualization={currentSlide?.type === 'word-cloud' ? currentSlide.visualization : 'cloud'}
      />
    ),
  }[currentSlideType];

  const presentationProjectorPreview =
    liveSlide && presentationSlide?.id === liveSlide.id
      ? {
          'multiple-choice': (
            <MultipleChoiceProjector
              question={liveMcQuestion}
              options={liveMcOptions}
              visualization={liveMcVisualization}
              resultDisplay={liveMcResultDisplay}
              compact
            />
          ),
          'open-answers': (
            <OpenAnswersProjector
              question={liveOpenQuestion}
              answers={liveOpenAnswers}
              focusedAnswerId={focusedAnswerId}
              onFocusedAnswerChange={onFocusedAnswerChange}
              visualization={liveOpenVisualization}
            />
          ),
          pulse: (
            <PulseProjector
              title={livePulseTitle}
              minLabel={livePulseMinLabel}
              maxLabel={livePulseMaxLabel}
              value={pulseParticipantValue}
              projectorView={livePulseProjectorView}
              distribution={livePulseDistribution}
              visualization={livePulseVisualization}
              metricDisplay={livePulseMetricDisplay}
              compact
            />
          ),
          'word-cloud': (
            <WordCloudProjector
              title={liveCloudTitle}
              words={liveCloudWords}
              participantWord={cloudParticipantWord}
              visualization={liveCloudVisualization}
            />
          ),
        }[liveSlide.type]
      : projectorPreview;

  function handleAddSlide(type: SlideType) {
    const nextSlide = createSlide(type, session.slides.length + 1);

    onSessionChange({
      ...session,
      slides: [...session.slides, nextSlide],
      currentSlideId: nextSlide.id,
    });
    setIsCreateSlideModalOpen(false);
  }

  function handleAddTemplateSlide(templateId: string) {
    const nextSlide = createTemplateSlide(templateId, session.slides.length + 1);

    onSessionChange({
      ...session,
      slides: [...session.slides, nextSlide],
      currentSlideId: nextSlide.id,
    });
    setIsCreateSlideModalOpen(false);
  }

  function handleDuplicateSlide(slideId: string) {
    const nextSlides = duplicateSlide(session.slides, slideId);
    const duplicatedIndex = nextSlides.findIndex((_, index) => {
      if (index === 0) {
        return false;
      }

      return nextSlides[index - 1]?.id === slideId;
    });
    const duplicatedSlide = duplicatedIndex >= 0 ? nextSlides[duplicatedIndex] : null;

    onSessionChange({
      ...session,
      slides: nextSlides,
      currentSlideId: duplicatedSlide?.id ?? session.currentSlideId,
    });
  }

  function handleRemoveSlide(slideId: string) {
    if (session.slides.length <= 1) {
      return;
    }

    const nextSlides = removeSlide(session.slides, slideId);
    const fallbackSlide = nextSlides[0] ?? null;

    onSessionChange({
      ...session,
      slides: nextSlides,
      currentSlideId: session.currentSlideId === slideId ? fallbackSlide?.id ?? session.currentSlideId : session.currentSlideId,
      liveSlideId: session.liveSlideId === slideId ? null : session.liveSlideId,
    });
  }

  function handleReorderSlides(draggedSlideId: string, targetSlideId: string) {
    onSessionChange({
      ...session,
      slides: reorderSlides(session.slides, draggedSlideId, targetSlideId),
    });
  }

  function handleSessionTitleChange(value: string) {
    onSessionChange({
      ...session,
      title: value,
    });
  }

  function handleJoinCodeChange(value: string) {
    onSessionChange({
      ...session,
      joinCode: value.toUpperCase().replace(/\s+/g, ''),
    });
  }

  function handleRefreshJoinAccess() {
    onSessionChange({
      ...session,
      joinCode: createJoinCode(),
    });
    setQrVersion((value) => value + 1);
  }

  function handleVisualizationChange(
    value: MultipleChoiceVisualization | OpenAnswersVisualization | PulseVisualization | WordCloudVisualization,
  ) {
    if (!currentSlide) {
      return;
    }

    onSessionChange({
      ...session,
      slides: session.slides.map((slide) => {
        if (slide.id !== currentSlide.id) {
          return slide;
        }

        switch (slide.type) {
          case 'multiple-choice':
            return { ...slide, visualization: value as typeof slide.visualization };
          case 'open-answers':
            return { ...slide, visualization: value as typeof slide.visualization };
          case 'pulse':
            return { ...slide, visualization: value as typeof slide.visualization };
          case 'word-cloud':
            return { ...slide, visualization: value as typeof slide.visualization };
          default:
            return slide;
        }
      }),
    });
  }

  async function handleCopyJoinLink() {
    try {
      await navigator.clipboard.writeText(joinLink);
      setCopiedState('done');
    } catch {
      setCopiedState('idle');
    }
  }

  function goToPresentationIndex(index: number) {
    const targetSlide = session.slides[index];

    if (!targetSlide) {
      return;
    }

    onSessionChange({
      ...session,
      currentSlideId: targetSlide.id,
    });
    onPublishLiveSlide(targetSlide.id);
  }

  function renderSpeakerSlidePreview(
    slide: SessionSlide | null,
    position: 'current' | 'side',
    label: string,
    slideNumber?: number,
  ) {
    if (!slide) {
      return (
        <div className={`speaker-slide-preview speaker-slide-preview-${position} speaker-slide-preview-empty`}>
          <div className="speaker-slide-meta">
            <span className="speaker-slide-label">{label}</span>
            <span className="speaker-slide-number">{slideNumber ? slideNumber : '—'}</span>
          </div>
          <strong>Нет слайда</strong>
        </div>
      );
    }

    return (
      <div className={`speaker-slide-preview speaker-slide-preview-${position} ${position === 'current' ? 'speaker-slide-preview-active' : ''}`}>
        <div className="speaker-slide-meta">
          <span className="speaker-slide-label">{label}</span>
          <div className="speaker-slide-meta-right">
            <span className="speaker-slide-type">{moduleMeta[slide.type].eyebrow}</span>
            <span className="speaker-slide-number">{slideNumber}</span>
          </div>
        </div>
        <strong className="speaker-slide-title">{slide.title || 'Без названия'}</strong>
        {position === 'current' ? (
          <div className="speaker-slide-live">
            {presentationProjectorPreview ?? (
              <div className="speaker-slide-live-empty">
                <strong>Нет активного слайда</strong>
              </div>
            )}
          </div>
        ) : (
          <div className="speaker-slide-visual" aria-hidden="true">
            {slide.type === 'multiple-choice' && (
              <div className="speaker-slide-bars">
                {slide.options.slice(0, 4).map((option, index) => (
                  <span
                    key={option.id}
                    className="speaker-slide-bar"
                    style={{ width: `${78 - index * 12}%`, background: option.color }}
                  />
                ))}
              </div>
            )}
            {slide.type === 'open-answers' && (
              <div className="speaker-slide-bubbles">
                <span>Ответ</span>
                <span>Идея</span>
                <span>Инсайт</span>
              </div>
            )}
            {slide.type === 'pulse' && (
              <div className="speaker-slide-scale">
                <div className="speaker-slide-line" />
                {[1, 2, 3, 4, 5].map((point) => (
                  <span key={point} className="speaker-slide-point" />
                ))}
              </div>
            )}
            {slide.type === 'word-cloud' && (
              <div className="speaker-slide-cloud">
                <span className="speaker-slide-word-lg">Идеи</span>
                <span>Команда</span>
                <span className="speaker-slide-word-sm">Рост</span>
                <span>Фокус</span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <AdminShell
      appTitle={appTitle}
      session={session}
      currentSlide={currentSlide}
      liveSlide={liveSlide}
      onCurrentSlideChange={(slideId) =>
        onSessionChange({ ...session, currentSlideId: slideId })
      }
      onCreateSlide={() => setIsCreateSlideModalOpen(true)}
      onDuplicateSlide={handleDuplicateSlide}
      onRemoveSlide={handleRemoveSlide}
      onReorderSlides={handleReorderSlides}
    >
      {isFrozen && <FreezeOverlay onResume={onFreezeToggle} />}
      {isCreateSlideModalOpen && (
        <div className="admin-modal-backdrop" onClick={() => setIsCreateSlideModalOpen(false)}>
          <div className="admin-modal card" onClick={(event) => event.stopPropagation()}>
            <div className="admin-modal-header">
              <div>
                <p className="muted" style={{ margin: 0 }}>Создание слайда</p>
                <h2 style={{ margin: '6px 0 0' }}>Что хотите получить от аудитории?</h2>
                <p className="hero-text" style={{ marginTop: 10 }}>
                  Сначала выберите цель взаимодействия. Вопрос, оформление и вид результата настроите на следующем шаге.
                </p>
              </div>
              <Button variant="ghost" onClick={() => setIsCreateSlideModalOpen(false)}>
                Закрыть
              </Button>
            </div>
            {slideChoiceGroups.map((group) => (
              <section key={group} className="section-stack" style={{ gap: 14 }}>
                <div className="admin-choice-group-title">
                  {group === 'Выбор из готовых вариантов' ? <BarChart3 size={16} /> : <MessageCircleMore size={16} />}
                  <p className="muted" style={{ margin: 0 }}>{group}</p>
                </div>
                <div className="admin-choice-grid">
                  {createSlideOptions
                    .filter((option) => option.group === group)
                    .map((option) => (
                      <button
                        key={option.type}
                        type="button"
                        className="admin-choice-card"
                        onClick={() => handleAddSlide(option.type)}
                      >
                        <span className="admin-choice-icon">{option.icon}</span>
                        <strong>{option.title}</strong>
                        <span className="muted">{option.description}</span>
                      </button>
                    ))}
                </div>
              </section>
            ))}
            <div className="section-stack" style={{ gap: 14 }}>
              <div className="admin-choice-group-title">
                <Cloud size={16} />
                <p className="muted" style={{ margin: 0 }}>Готовые заготовки</p>
              </div>
              <div className="admin-template-list admin-template-list-compact">
              {slideTemplates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  className="admin-template-card"
                  onClick={() => handleAddTemplateSlide(template.id)}
                >
                  <span className="admin-choice-icon">
                    {template.type === 'multiple-choice' ? <BarChart3 size={18} /> :
                     template.type === 'pulse' ? <Waves size={18} /> :
                     template.type === 'open-answers' ? <MessageCircleMore size={18} /> :
                     <Cloud size={18} />}
                  </span>
                  <strong>{template.label}</strong>
                  <span className="muted">{template.description}</span>
                </button>
              ))}
            </div>
            </div>
          </div>
        </div>
      )}
      <div className="section-stack">
        <section className="admin-hero card">
          <div className="admin-hero-copy">
            <p className="muted" style={{ margin: 0 }}>Панель управления</p>
            <h1 className="hero-title">Пульсар</h1>
            <p className="hero-text">
              Редактируйте текущий слайд, проверяйте preview и выводите нужный экран в эфир.
            </p>
            <div className="button-row" style={{ marginTop: 12 }}>
              <Button
                icon={<MonitorPlay size={18} />}
                onClick={onLaunchAudienceScreen}
              >
                Запустить трансляцию
              </Button>
              <Button icon={<LayoutDashboard size={18} />} variant="ghost" onClick={onFreezeToggle}>
                {isFrozen ? 'Снять паузу' : 'Заморозить экран'}
              </Button>
            </div>

            <div className="admin-session-inline card">
              <div className="admin-session-inline-form">
                <label className="admin-field">
                  <span className="admin-field-label">Название сессии</span>
                  <input
                    className="admin-field-input"
                    value={session.title}
                    onChange={(event) => handleSessionTitleChange(event.target.value)}
                    placeholder="Например, Q2 Town Hall"
                  />
                </label>
                <label className="admin-field">
                  <span className="admin-field-label">Код подключения</span>
                  <input
                    className="admin-field-input admin-field-input-code"
                    value={session.joinCode}
                    onChange={(event) => handleJoinCodeChange(event.target.value)}
                    placeholder="PULSAR42"
                    maxLength={12}
                  />
                </label>
                <label className="admin-field">
                  <span className="admin-field-label">Ссылка на трансляцию</span>
                  <div className="admin-link-row">
                    <a className="admin-link-card" href={joinLink} target="_blank" rel="noreferrer">
                      <Link2 size={15} />
                      <span>{joinLink}</span>
                    </a>
                    <Button variant="ghost" onClick={handleCopyJoinLink} icon={<Copy size={14} />}>
                      {copiedState === 'done' ? 'Скопировано' : 'Копировать'}
                    </Button>
                  </div>
                </label>
              </div>
              <div className="admin-session-qr">
                <div className="admin-session-qr-actions">
                  <Button
                    variant="ghost"
                    onClick={handleRefreshJoinAccess}
                    icon={<RefreshCw size={14} />}
                    aria-label="Обновить код подключения"
                    title="Обновить код подключения"
                    style={{ width: 44, justifyContent: 'center', padding: '12px 0', gap: 0 }}
                  >
                    {''}
                  </Button>
                </div>
                <img
                  key={qrCodeUrl}
                  src={qrCodeUrl}
                  alt={`QR-код для подключения к сессии ${session.joinCode}`}
                />
                <span className="muted">Сканируйте, чтобы открыть экран участника</span>
              </div>
            </div>
          </div>

          <div className="admin-status-panel">
            <div className="admin-status-head">
              <div className="admin-status-stack">
                <div className="admin-status-chip">
                  <span className="admin-status-dot" />
                  <span>{isFrozen ? 'Трансляция на паузе' : 'В эфире'}</span>
                </div>
                <div className="admin-status-signal">
                  <div className={`admin-status-eq ${isFrozen ? 'admin-status-eq-paused' : ''}`} aria-hidden="true">
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              </div>
              <div className="admin-status-card admin-status-card-participants">
                <p className="muted">Участники</p>
                <strong>{audienceCount}</strong>
              </div>
            </div>
            <div className="admin-speaker-stage">
              {renderSpeakerSlidePreview(
                presentationSlide,
                'current',
                'Текущий слайд',
                presentationIndex >= 0 ? presentationIndex + 1 : undefined,
              )}
              <div className="admin-speaker-neighbors">
                {renderSpeakerSlidePreview(
                  previousPresentationSlide,
                  'side',
                  'Предыдущий',
                  presentationIndex > 0 ? presentationIndex : undefined,
                )}
                {renderSpeakerSlidePreview(
                  nextPresentationSlide,
                  'side',
                  'Следующий',
                  presentationIndex >= 0 && presentationIndex < session.slides.length - 1 ? presentationIndex + 2 : undefined,
                )}
              </div>
              <div className="admin-speaker-nav">
                <Button
                  variant="ghost"
                  icon={<SkipBack size={14} />}
                  onClick={() => goToPresentationIndex(0)}
                  disabled={presentationIndex <= 0}
                >
                  В начало
                </Button>
                <Button
                  variant="ghost"
                  icon={<ChevronLeft size={14} />}
                  onClick={() => goToPresentationIndex(presentationIndex - 1)}
                  disabled={presentationIndex <= 0}
                >
                  Назад
                </Button>
                <Button
                  icon={<ChevronRight size={14} />}
                  onClick={() => goToPresentationIndex(presentationIndex + 1)}
                  disabled={presentationIndex < 0 || presentationIndex >= session.slides.length - 1}
                >
                  Вперед
                </Button>
                <Button
                  variant="ghost"
                  icon={<SkipForward size={14} />}
                  onClick={() => goToPresentationIndex(session.slides.length - 1)}
                  disabled={presentationIndex < 0 || presentationIndex >= session.slides.length - 1}
                >
                  В конец
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section className="admin-editor-layout">
          <div className="admin-editor-pane">
            <div className="admin-editor-intro">
              <p className="muted" style={{ margin: 0 }}>Настройки текущего слайда</p>
              <h2 style={{ margin: '6px 0 0' }}>{currentSlide?.title ?? 'Выберите слайд'}</h2>
              <p className="hero-text" style={{ marginTop: 10 }}>
                <strong>{activeMeta.eyebrow}</strong> {'·'} {activeMeta.summary}
              </p>
            </div>
            {activeModuleEditor}
          </div>
          <aside className="admin-preview-pane">
            <div className="admin-preview-card admin-preview-card-projector card">
              <div className="admin-preview-header">
                <p className="muted" style={{ margin: 0 }}>Предпросмотр</p>
                <strong>Проектор</strong>
              </div>
              <div className="admin-preview-body admin-preview-body-projector">
                {projectorPreview}
              </div>
            </div>

            <div className="admin-preview-card-phone">
              <div className="admin-preview-header">
                <p className="muted" style={{ margin: 0 }}>Предпросмотр</p>
                <strong>Телефон участника</strong>
              </div>
              <div className="admin-phone-mockup">
                <div className="admin-phone-speaker" />
                <div className="admin-phone-frame">
                  <div className="admin-phone-screen">
                    <div className="admin-preview-body admin-preview-body-mobile">
                      {liveParticipantPreview}
                    </div>
                  </div>
                </div>
                <div className="admin-phone-home" />
              </div>
            </div>
          </aside>
        </section>
      </div>
    </AdminShell>
  );
}
