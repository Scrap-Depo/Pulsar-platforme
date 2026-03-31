import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import MultipleChoiceParticipant from '../features/multiple-choice/components/MultipleChoiceParticipant';
import OpenAnswersParticipant from '../features/open-answers/components/OpenAnswersParticipant';
import PulseParticipant from '../features/pulse/components/PulseParticipant';
import WordCloudParticipant from '../features/word-cloud/components/WordCloudParticipant';
import ParticipantShell from '../widgets/layout/ParticipantShell';
import Button from '../shared/ui/Button';
import { AppScreen, LiveModule, Participant } from '../shared/types/common';
import { MultipleChoiceOption } from '../features/multiple-choice/model/types';
import { OpenAnswer } from '../features/open-answers/model/types';
import { WordCloudItem } from '../features/word-cloud/model/types';

type ParticipantPageProps = {
  appTitle: string;
  participants: Participant[];
  activeParticipant: Participant | null;
  joinCode: string;
  joinCodeDraft: string;
  joinError: string;
  joinPending: boolean;
  liveModule: LiveModule;
  mcQuestion: string;
  mcOptions: MultipleChoiceOption[];
  mcParticipantVote: number | null;
  mcHasVoted: boolean;
  openQuestion: string;
  openAnswers: OpenAnswer[];
  participantPhrase: string;
  stickersUsed: number;
  allowLikes: boolean;
  likedIds: string[];
  pulseTitle: string;
  pulseMinLabel: string;
  pulseMaxLabel: string;
  pulseParticipantValue: number;
  cloudTitle: string;
  cloudParticipantWord: string;
  cloudUseAI: boolean;
  cloudWords: WordCloudItem[];
  onMcParticipantVoteChange: (value: number) => void;
  onMcResetVote: () => void;
  onMcSubmit: () => void;
  onParticipantPhraseChange: (value: string) => void;
  onOpenSubmit: () => void;
  onOpenLikeToggle: (id: string) => void;
  onPulseParticipantValueChange: (value: number) => void;
  onCloudParticipantWordChange: (value: string) => void;
  onActiveParticipantChange: (participantId: string) => void;
  onAddParticipant: () => void;
  onJoinCodeDraftChange: (value: string) => void;
  onJoinSession: () => void;
  onScreenChange: (screen: AppScreen) => void;
};

export default function ParticipantPage({
  appTitle,
  participants,
  activeParticipant,
  joinCode,
  joinCodeDraft,
  joinError,
  joinPending,
  liveModule,
  mcQuestion,
  mcOptions,
  mcParticipantVote,
  mcHasVoted,
  openQuestion,
  openAnswers,
  participantPhrase,
  stickersUsed,
  allowLikes,
  likedIds,
  pulseTitle,
  pulseMinLabel,
  pulseMaxLabel,
  pulseParticipantValue,
  cloudTitle,
  cloudParticipantWord,
  cloudUseAI,
  cloudWords,
  onMcParticipantVoteChange,
  onMcResetVote,
  onMcSubmit,
  onParticipantPhraseChange,
  onOpenSubmit,
  onOpenLikeToggle,
  onPulseParticipantValueChange,
  onCloudParticipantWordChange,
  onActiveParticipantChange,
  onAddParticipant,
  onJoinCodeDraftChange,
  onJoinSession,
  onScreenChange,
}: ParticipantPageProps) {
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
  const moduleContent = {
    'multiple-choice': (
      <MultipleChoiceParticipant
        question={mcQuestion}
        options={mcOptions}
        participantVote={mcParticipantVote}
        hasVoted={mcHasVoted}
        onVoteChange={onMcParticipantVoteChange}
        onReset={onMcResetVote}
        onSubmit={onMcSubmit}
      />
    ),
    'open-answers': (
      <OpenAnswersParticipant
        question={openQuestion}
        answers={openAnswers}
        participantPhrase={participantPhrase}
        stickersUsed={stickersUsed}
        allowLikes={allowLikes}
        likedIds={likedIds}
        onPhraseChange={onParticipantPhraseChange}
        onSubmit={onOpenSubmit}
        onToggleLike={onOpenLikeToggle}
      />
    ),
    pulse: (
      <PulseParticipant
        title={pulseTitle}
        minLabel={pulseMinLabel}
        maxLabel={pulseMaxLabel}
        value={pulseParticipantValue}
        onValueChange={onPulseParticipantValueChange}
      />
    ),
    'word-cloud': (
      <WordCloudParticipant
        title={cloudTitle}
        participantWord={cloudParticipantWord}
        useAI={cloudUseAI}
        words={cloudWords}
        onParticipantWordChange={onCloudParticipantWordChange}
      />
    ),
  }[liveModule ?? 'multiple-choice'];

  if (!activeParticipant) {
    return (
      <ParticipantShell appTitle={appTitle}>
        <div className="section-stack">
          <div className="card" style={{ padding: 28, maxWidth: 680 }}>
            <p className="muted" style={{ marginTop: 0 }}>Подключение к сессии</p>
            <h1 className="hero-title">Войти в {appTitle}</h1>
            <p className="hero-text">
              Введите только код сессии. Участники подключаются анонимно.
            </p>
            <div className="section-stack" style={{ marginTop: 20 }}>
              <label style={{ display: 'grid', gap: 8 }}>
                <span className="muted">Код подключения</span>
                <input
                  type="text"
                  value={joinCodeDraft}
                  onChange={(event) => onJoinCodeDraftChange(event.target.value.toUpperCase())}
                  placeholder={`Например, ${joinCode}`}
                  style={{
                    borderRadius: 14,
                    padding: 12,
                    border: '1px solid rgba(148, 163, 184, 0.18)',
                    background: 'rgba(2, 6, 23, 0.35)',
                    color: '#e2e8f0',
                    textTransform: 'uppercase',
                  }}
                />
              </label>
              {joinError && <p style={{ margin: 0, color: '#fda4af' }}>{joinError}</p>}
              <div className="button-row">
                <Button onClick={onJoinSession}>
                  {joinPending ? 'Подключаем...' : 'Присоединиться'}
                </Button>
                <Button variant="ghost" onClick={() => onScreenChange('admin')}>
                  Назад в админку
                </Button>
              </div>
            </div>
          </div>
        </div>
      </ParticipantShell>
    );
  }

  return (
    <ParticipantShell appTitle={appTitle}>
      <div className="section-stack">
        <div className="card" style={{ padding: 28 }}>
          <div className="panel-header-row">
            <h1 className="hero-title" style={{ marginBottom: 0 }}>Экран участника</h1>
            <Button variant="ghost" onClick={() => setIsPanelCollapsed((value) => !value)}>
              {isPanelCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            </Button>
          </div>
          {!isPanelCollapsed && (
            <>
              <p className="muted" style={{ marginBottom: 14 }}>
                Активный участник: <strong style={{ color: '#e2e8f0' }}>{activeParticipant.name}</strong>
              </p>
              <div className="button-row" style={{ marginBottom: 16 }}>
                {participants.map((participant) => (
                  <Button
                    key={participant.id}
                    variant={participant.id === activeParticipant.id ? 'primary' : 'secondary'}
                    onClick={() => onActiveParticipantChange(participant.id)}
                  >
                    {participant.name}
                  </Button>
                ))}
                <Button variant="ghost" onClick={onAddParticipant}>
                  Добавить участника
                </Button>
              </div>
              <p className="hero-text">
                В этом слое живут формы ответа и взаимодействия аудитории.
                <strong> {liveModule ? ` Сейчас активен модуль ${liveModule}.` : ' Сейчас модуль не выведен в эфир.'}</strong>
              </p>
              <div className="button-row" style={{ marginTop: 20 }}>
                <Button variant="secondary" onClick={() => onScreenChange('admin')}>
                  Вернуться в админку
                </Button>
              </div>
            </>
          )}
        </div>
        {liveModule ? (
          moduleContent
        ) : (
          <div className="card" style={{ padding: 28 }}>
            <h2 style={{ marginTop: 0 }}>Ожидание запуска</h2>
            <p className="hero-text">Когда модуль пустят в эфир из админки, здесь появится интерфейс участника.</p>
          </div>
        )}
      </div>
    </ParticipantShell>
  );
}
