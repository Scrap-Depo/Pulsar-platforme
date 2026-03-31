import { WordCloudItem } from './types';

export function sortWordsByCount(words: WordCloudItem[]) {
  return [...words].sort((left, right) => right.count - left.count);
}

export function normalizeWord(value: string, useAI: boolean) {
  const clean = value.trim().toLowerCase();

  if (!useAI) {
    return clean;
  }

  return clean
    .replace(/[.,!?;:]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function mergeParticipantWord(words: WordCloudItem[], participantWord: string, useAI: boolean) {
  const normalizedWord = normalizeWord(participantWord, useAI);

  if (!normalizedWord) {
    return words;
  }

  const existingIndex = words.findIndex((word) => word.text === normalizedWord);
  const nextWords = [...words];

  if (existingIndex >= 0) {
    nextWords[existingIndex] = {
      ...nextWords[existingIndex],
      count: nextWords[existingIndex].count + 10,
    };
  } else {
    nextWords.push({
      text: normalizedWord,
      count: 25,
      color: '#f8fafc',
    });
  }

  return sortWordsByCount(nextWords);
}
