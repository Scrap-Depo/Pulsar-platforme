import MultipleChoiceParticipant from '../features/multiple-choice/components/MultipleChoiceParticipant';
import OpenAnswersParticipant from '../features/open-answers/components/OpenAnswersParticipant';
import PulseParticipant from '../features/pulse/components/PulseParticipant';
import WordCloudParticipant from '../features/word-cloud/components/WordCloudParticipant';
import ParticipantShell from '../widgets/layout/ParticipantShell';
import Button from '../shared/ui/Button';
import { LiveModule, Participant } from '../shared/types/common';
import { MultipleChoiceOption } from '../features/multiple-choice/model/types';
import { OpenAnswer } from '../features/open-answers/model/types';
import { WordCloudItem } from '../features/word-cloud/model/types';

type ParticipantPageProps = {
  appTitle: string;
  activeParticipant: Participant | null;
  sessionSynced: boolean;
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
  onJoinCodeDraftChange: (value: string) => void;
  onJoinSession: () => void;
  onRefreshJoinLink: () => void;
};

export default function ParticipantPage({
  appTitle,
  activeParticipant,
  sessionSynced,
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
  onJoinCodeDraftChange,
  onJoinSession,
  onRefreshJoinLink,
}: ParticipantPageProps) {
  const hasPrefilledJoinCode = Boolean(joinCodeDraft.trim());
  const isStaleCode = Boolean(joinError && joinError.includes('устарел'));
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
      <ParticipantShell>
        <div className="section-stack">
          <div className="card" style={{ padding: 28, maxWidth: 680 }}>
            <p className="muted" style={{ marginTop: 0 }}>Подключение к сессии</p>
            <h1 className="hero-title">Войти в {appTitle}</h1>
            <p className="hero-text">
              Вы подключаетесь анонимно.
            </p>
            <div className="section-stack" style={{ marginTop: 20 }}>
              {hasPrefilledJoinCode ? (
                <div style={{ display: 'grid', gap: 8 }}>
                  <span className="muted">Код сессии</span>
                  <div
                    style={{
                      borderRadius: 14,
                      padding: 12,
                      border: '1px solid rgba(148, 163, 184, 0.18)',
                      background: 'rgba(2, 6, 23, 0.35)',
                      color: '#e2e8f0',
                      textTransform: 'uppercase',
                      fontWeight: 700,
                      letterSpacing: '0.04em',
                    }}
                  >
                    {joinCodeDraft}
                  </div>
                </div>
              ) : (
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
              )}
              {joinError && <p style={{ margin: 0, color: '#fda4af' }}>{joinError}</p>}
              <div className="button-row">
                <Button onClick={onJoinSession} disabled={joinPending || isStaleCode}>
                  {joinPending ? 'Входим...' : 'Войти'}
                </Button>
                {isStaleCode && (
                  <Button variant="ghost" onClick={onRefreshJoinLink}>
                    Обновить страницу
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </ParticipantShell>
    );
  }

  return (
    <ParticipantShell>
      <div className="section-stack">
        {!sessionSynced ? (
          <div className="card" style={{ padding: 28 }}>
            <h2 style={{ marginTop: 0 }}>Подключаем актуальный слайд</h2>
            <p className="hero-text" style={{ marginBottom: 0 }}>
              Ждем текущий эфир из сессии, чтобы показать вам именно тот вопрос, который сейчас открыт у ведущего.
            </p>
          </div>
        ) : liveModule ? (
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
