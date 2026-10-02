import { createHash, randomBytes } from 'node:crypto';

export const TYPES = ['multiple-choice', 'pulse', 'open-answers', 'word-cloud'];
export function fail(message) {
  throw new Error(message);
}
export function text(value, max, label = 'Текст') {
  if (typeof value !== 'string' || !value.trim() || [...value.trim()].length > max)
    fail(`${label}: от 1 до ${max} символов.`);
  return value.trim();
}
export function validSlide(value) {
  if (!value || !TYPES.includes(value.type)) fail('Неизвестный тип вопроса.');
  const slide = structuredClone(value);
  slide.id = text(slide.id, 100, 'ID');
  slide.title = text(slide.title, 300, 'Вопрос');
  if (slide.type === 'multiple-choice') {
    if (!Array.isArray(slide.options) || slide.options.length < 2 || slide.options.length > 10)
      fail('Нужно от 2 до 10 вариантов.');
    slide.options = slide.options.map((o) => ({
      id: o.id,
      text: text(o.text, 120, 'Вариант'),
      votes: 0,
      color: '#479ddb',
    }));
    if (
      slide.options.some((o) => !Number.isSafeInteger(o.id)) ||
      new Set(slide.options.map((o) => o.id)).size !== slide.options.length
    )
      fail('Варианты должны иметь уникальные ID.');
  }
  if (slide.type === 'pulse') {
    slide.minLabel = text(slide.minLabel, 60);
    slide.maxLabel = text(slide.maxLabel, 60);
    slide.metricDisplay = 'average';
  }
  return slide;
}
export function settings(input = {}) {
  return {
    cardLimit: input.cardLimit === 3 ? 3 : 1,
    moderation: input.moderation !== false,
    immediate: input.immediate === true,
  };
}
export function responseValue(slide, value) {
  if (slide.type === 'multiple-choice') {
    if (!slide.options.some((o) => o.id === value)) fail('Выберите существующий вариант.');
    return value;
  }
  if (slide.type === 'pulse') {
    if (!Number.isInteger(value) || value < 1 || value > 10) fail('Выберите оценку от 1 до 10.');
    return value;
  }
  return text(value, slide.type === 'open-answers' ? 300 : 40);
}
export function responseId(roundId, uid, slot) {
  return createHash('sha256').update(`${roundId}:${uid}:${slot}`).digest('hex');
}
export function joinCode() {
  return randomBytes(5).toString('hex').toUpperCase();
}
export function publicResponse(response) {
  return {
    id: response.id,
    type: response.type,
    value: response.displayValue ?? response.value,
    edited: response.displayValue != null,
    revision: response.revision,
    likes: response.likes ?? 0,
  };
}

// Small per-participant receipt. Original/history remain in the host collection.
export function ownResponse(response) {
  const { id, slot, value, revision, requestId, moderation, displayValue } = response;
  return { id, slot, value, revision, requestId, moderation, displayValue };
}
