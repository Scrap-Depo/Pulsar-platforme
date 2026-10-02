import { createHash, randomInt } from 'node:crypto';

export const TYPES = ['multiple-choice', 'pulse', 'open-answers', 'word-cloud'];
export function fail(message) {
  throw new Error(message);
}
export function text(value, max, label = 'Текст') {
  if (typeof value !== 'string' || !value.trim() || [...value.trim()].length > max)
    fail(`${label}: от 1 до ${max} символов.`);
  return value.trim();
}
function draftText(value, max, label) {
  if (typeof value !== 'string' || [...value.trim()].length > max)
    fail(`${label}: не больше ${max} символов.`);
  return value.trim();
}
function choice(value, values, fallback) {
  return values.includes(value) ? value : fallback;
}
export function settings(input = {}) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  return {
    cardLimit: source.cardLimit === 3 ? 3 : 1,
    moderation: source.moderation !== false,
    immediate: source.immediate === true,
    showOnPhones: source.showOnPhones === true,
  };
}
export function launchSettings(slide, input = slide.launch) {
  const defaults = { cardLimit: 1, moderation: true, immediate: true };
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const config = settings({ ...defaults, ...source });
  return {
    ...config,
    cardLimit: slide.type === 'open-answers' ? config.cardLimit : 1,
    moderation: ['open-answers', 'word-cloud'].includes(slide.type) && config.moderation,
  };
}
export function validSlide(value) {
  if (!value || !TYPES.includes(value.type)) fail('Неизвестный тип вопроса.');
  const slide = {
    id: text(value.id, 100, 'ID'),
    title: draftText(value.title, 300, 'Вопрос'),
    type: value.type,
  };
  if (Object.hasOwn(value, 'launch')) slide.launch = launchSettings(slide, value.launch);
  if (slide.type === 'multiple-choice') {
    if (!Array.isArray(value.options) || value.options.length < 2 || value.options.length > 10)
      fail('Нужно от 2 до 10 вариантов.');
    slide.options = value.options.map((o) => ({
      id: o?.id,
      text: draftText(o?.text, 120, 'Вариант'),
      votes: 0,
      color: '#479ddb',
    }));
    if (
      slide.options.some((o) => !Number.isSafeInteger(o.id)) ||
      new Set(slide.options.map((o) => o.id)).size !== slide.options.length
    )
      fail('Варианты должны иметь уникальные ID.');
    slide.visualization = choice(value.visualization, ['bar', 'pie', 'donut'], 'bar');
    slide.resultDisplay = choice(value.resultDisplay, ['percent', 'votes', 'both'], 'both');
  }
  if (slide.type === 'pulse') {
    slide.minLabel = text(value.minLabel, 60);
    slide.maxLabel = text(value.maxLabel, 60);
    slide.metricDisplay = 'average';
    slide.visualization = choice(value.visualization, ['scale', 'bars', 'line'], 'scale');
    slide.projectorView = choice(value.projectorView, ['histogram', 'summary'], 'histogram');
  }
  if (slide.type === 'open-answers') {
    slide.allowLikes = value.allowLikes === true;
    slide.visualization = choice(value.visualization, ['cards', 'bubbles', 'wall'], 'cards');
  }
  if (slide.type === 'word-cloud') {
    slide.useAI = value.useAI === true;
    slide.visualization = choice(
      value.visualization,
      ['cloud', 'bubbles', 'constellation'],
      'cloud',
    );
  }
  return slide;
}
export function launchProblem(slide) {
  if (!slide.title.trim()) return 'Введите текст вопроса перед запуском.';
  if (slide.type === 'multiple-choice') {
    if (slide.options.some((option) => !option.text.trim()))
      return 'Заполните все варианты ответа перед запуском.';
    const options = slide.options.map((option) =>
      option.text.trim().replace(/\s+/gu, ' ').toLocaleLowerCase('ru-RU'),
    );
    if (new Set(options).size !== options.length)
      return 'Варианты ответа должны отличаться друг от друга.';
  }
  return null;
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
  const alphabet = '2345679ACDEFGHJKLMNPQRSTUVWXYZ';
  return Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join('');
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
