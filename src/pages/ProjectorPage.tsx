import MultipleChoiceProjector from '../features/multiple-choice/components/MultipleChoiceProjector';
import OpenAnswersProjector from '../features/open-answers/components/OpenAnswersProjector';
import PulseProjector from '../features/pulse/components/PulseProjector';
import WordCloudProjector from '../features/word-cloud/components/WordCloudProjector';
import ProjectorShell from '../widgets/layout/ProjectorShell';
import Button from '../shared/ui/Button';
import { ChevronLeft } from 'lucide-react';
import {
  LiveModule,
  MultipleChoiceResultDisplay,
  MultipleChoiceVisualization,
  OpenAnswersVisualization,
  PulseMetricDisplay,
  PulseVisualization,
  WordCloudVisualization,
} from '../shared/types/common';
import { MultipleChoiceOption } from '../features/multiple-choice/model/types';
import { OpenAnswer } from '../features/open-answers/model/types';
import { PulseDistribution, PulseProjectorView } from '../features/pulse/model/types';
import { WordCloudItem } from '../features/word-cloud/model/types';

type ProjectorPageProps = {
  appTitle: string;
  liveModule: LiveModule;
  isFrozen: boolean;
  mcQuestion: string;
  mcOptions: MultipleChoiceOption[];
  mcVisualization: MultipleChoiceVisualization;
  mcResultDisplay: MultipleChoiceResultDisplay;
  openQuestion: string;
  openAnswers: OpenAnswer[];
  focusedAnswerId: string | null;
  openVisualization: OpenAnswersVisualization;
  pulseTitle: string;
  pulseMinLabel: string;
  pulseMaxLabel: string;
  pulseParticipantValue: number;
  pulseProjectorView: PulseProjectorView;
  pulseDistribution: PulseDistribution;
  pulseVisualization: PulseVisualization;
  pulseMetricDisplay: PulseMetricDisplay;
  cloudTitle: string;
  cloudWords: WordCloudItem[];
  cloudParticipantWord: string;
  cloudVisualization: WordCloudVisualization;
  onFocusedAnswerChange: (id: string | null) => void;
  onReturnToAdmin: () => void;
};

export default function ProjectorPage({
  appTitle,
  liveModule,
  isFrozen,
  mcQuestion,
  mcOptions,
  mcVisualization,
  mcResultDisplay,
  openQuestion,
  openAnswers,
  focusedAnswerId,
  openVisualization,
  pulseTitle,
  pulseMinLabel,
  pulseMaxLabel,
  pulseParticipantValue,
  pulseProjectorView,
  pulseDistribution,
  pulseVisualization,
  pulseMetricDisplay,
  cloudTitle,
  cloudWords,
  cloudParticipantWord,
  cloudVisualization,
  onFocusedAnswerChange,
  onReturnToAdmin,
}: ProjectorPageProps) {
  const moduleContent = {
    'multiple-choice': (
      <MultipleChoiceProjector
        question={mcQuestion}
        options={mcOptions}
        visualization={mcVisualization}
        resultDisplay={mcResultDisplay}
      />
    ),
    'open-answers': (
      <OpenAnswersProjector
        question={openQuestion}
        answers={openAnswers}
        focusedAnswerId={focusedAnswerId}
        onFocusedAnswerChange={onFocusedAnswerChange}
        visualization={openVisualization}
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
        visualization={pulseVisualization}
        metricDisplay={pulseMetricDisplay}
      />
    ),
    'word-cloud': (
      <WordCloudProjector
        title={cloudTitle}
        words={cloudWords}
        participantWord={cloudParticipantWord}
        visualization={cloudVisualization}
      />
    ),
  }[liveModule ?? 'multiple-choice'];

  return (
    <ProjectorShell appTitle={appTitle}>
      <div className="section-stack">
        <div className="projector-return-bar">
          <Button variant="ghost" icon={<ChevronLeft size={16} />} onClick={onReturnToAdmin}>
            Вернуться в пульт
          </Button>
        </div>
        <div className="projector-stage card" style={{ opacity: isFrozen ? 0.45 : 1 }}>
          {isFrozen ? (
            <div style={{ textAlign: 'center' }}>
              <h1 className="hero-title">Трансляция на паузе</h1>
              <p className="hero-text">Когда снимем паузу, аудитория снова увидит активный модуль.</p>
            </div>
          ) : !liveModule ? (
            <div style={{ textAlign: 'center' }}>
              <h1 className="hero-title">Эфир пока пуст</h1>
              <p className="hero-text">Выберите модуль в админке и пустите его в эфир.</p>
            </div>
          ) : (
            moduleContent
          )}
        </div>
      </div>
    </ProjectorShell>
  );
}
