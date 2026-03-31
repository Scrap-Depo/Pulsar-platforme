import { OpenAnswer } from './types';

export function sortAnswersByLikes(answers: OpenAnswer[]) {
  return [...answers].sort((left, right) => right.likes - left.likes);
}

export function updateAnswerText(answers: OpenAnswer[], id: string, text: string) {
  return answers.map((answer) => (answer.id === id ? { ...answer, text } : answer));
}

export function toggleAnswerLike(answers: OpenAnswer[], id: string, isLiked: boolean) {
  return sortAnswersByLikes(
    answers.map((answer) =>
      answer.id === id ? { ...answer, likes: answer.likes + (isLiked ? -1 : 1) } : answer,
    ),
  );
}
