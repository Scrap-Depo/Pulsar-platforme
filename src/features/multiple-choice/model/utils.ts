import { MultipleChoiceOption } from './types';

export function getVotePercent(votes: number, total: number) {
  if (total === 0) {
    return 0;
  }

  return Math.round((votes / total) * 100);
}

export function sortOptionsByVotes(options: MultipleChoiceOption[]) {
  return [...options].sort((left, right) => right.votes - left.votes);
}
