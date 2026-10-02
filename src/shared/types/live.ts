import { LaunchSettings, SessionSlide } from './common';
export type RoundSettings = LaunchSettings;
export type Round = {
  id: string;
  slide: SessionSlide;
  phase: 'open' | 'closed';
  visible: boolean;
  likesOpen: boolean;
  settings: RoundSettings;
  deadline: string | null;
  createdAt?: string;
};
export type PublicResponse = {
  id: string;
  type: SessionSlide['type'];
  value: string | number;
  edited: boolean;
  likes: number;
  revision: number;
};
export type Response = PublicResponse & {
  participantId: string;
  slot: number;
  moderation: 'pending' | 'approved' | 'hidden';
  displayValue: string | null;
  createdAt: string;
  updatedAt: string;
  requestId: string;
  history: Array<{ value: string | number; displayValue: string | null; at: string }>;
};
export type OwnResponse = Pick<
  Response,
  'id' | 'slot' | 'value' | 'revision' | 'requestId' | 'moderation' | 'displayValue'
>;
export type OwnAnswers = { answers: Record<string, OwnResponse> };
export type Meeting = {
  id: string;
  title: string;
  joinCode: string;
  ownerUid: string;
  status: 'draft' | 'live' | 'finished' | 'deleting';
  slides: SessionSlide[];
  currentSlideId: string;
  liveSlideId: string | null;
  roundId: string | null;
  version: number;
  createdAt: string;
};
export type Room = {
  title: string;
  status: Meeting['status'];
  round: Round | null;
  joinedCount: number;
};
