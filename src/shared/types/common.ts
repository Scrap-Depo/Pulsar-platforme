import { MultipleChoiceOption } from '../../features/multiple-choice/model/types';
import { PulseProjectorView } from '../../features/pulse/model/types';

export type AppScreen = 'admin' | 'participant' | 'projector';

export type SlideType =
  | 'multiple-choice'
  | 'open-answers'
  | 'pulse'
  | 'word-cloud';

export type ModuleId = SlideType;

export type SessionStatus = 'draft' | 'live' | 'finished';

type BaseSlide = {
  id: string;
  title: string;
  type: SlideType;
};

export type MultipleChoiceVisualization = 'bar' | 'pie' | 'donut';
export type MultipleChoiceResultDisplay = 'percent' | 'votes' | 'both';
export type OpenAnswersVisualization = 'cards' | 'bubbles' | 'wall';
export type PulseVisualization = 'scale' | 'bars' | 'line';
export type PulseMetricDisplay = 'average' | 'participant' | 'both';
export type WordCloudVisualization = 'cloud' | 'bubbles' | 'constellation';

export type MultipleChoiceSessionSlide = BaseSlide & {
  type: 'multiple-choice';
  options: MultipleChoiceOption[];
  visualization: MultipleChoiceVisualization;
  resultDisplay: MultipleChoiceResultDisplay;
};

export type OpenAnswersSessionSlide = BaseSlide & {
  type: 'open-answers';
  allowLikes: boolean;
  visualization: OpenAnswersVisualization;
};

export type PulseSessionSlide = BaseSlide & {
  type: 'pulse';
  minLabel: string;
  maxLabel: string;
  projectorView: PulseProjectorView;
  visualization: PulseVisualization;
  metricDisplay: PulseMetricDisplay;
};

export type WordCloudSessionSlide = BaseSlide & {
  type: 'word-cloud';
  useAI: boolean;
  visualization: WordCloudVisualization;
};

export type SessionSlide =
  | MultipleChoiceSessionSlide
  | OpenAnswersSessionSlide
  | PulseSessionSlide
  | WordCloudSessionSlide;

export type Session = {
  id: string;
  title: string;
  joinCode: string;
  status: SessionStatus;
  currentSlideId: string;
  liveSlideId: string | null;
  slides: SessionSlide[];
};

export type Participant = {
  id: string;
  name: string;
};

type BaseResponse = {
  id: string;
  sessionId: string;
  slideId: string;
  participantId: string;
  createdAt: string;
};

export type MultipleChoiceResponse = BaseResponse & {
  type: 'multiple-choice';
  value: number;
};

export type OpenAnswersResponse = BaseResponse & {
  type: 'open-answers';
  value: string;
};

export type PulseResponse = BaseResponse & {
  type: 'pulse';
  value: number;
};

export type WordCloudResponse = BaseResponse & {
  type: 'word-cloud';
  value: string;
};

export type SessionResponse =
  | MultipleChoiceResponse
  | OpenAnswersResponse
  | PulseResponse
  | WordCloudResponse;

export type LiveModule = SlideType | null;
