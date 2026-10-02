import { LaunchSettings, SessionSlide } from '../types/common';

export function questionLaunchSettings(slide: SessionSlide): LaunchSettings {
  const input = slide.launch;
  return {
    cardLimit: slide.type === 'open-answers' && input?.cardLimit === 3 ? 3 : 1,
    moderation: ['open-answers', 'word-cloud'].includes(slide.type) && input?.moderation !== false,
    immediate: input?.immediate !== false,
    showOnPhones: input?.showOnPhones === true,
  };
}

export function launchProblem(slide: SessionSlide): string | null {
  if (!slide.title.trim()) return 'Введите вопрос перед запуском.';
  if (slide.type === 'multiple-choice') {
    if (slide.options.length < 2) return 'Добавьте минимум два варианта ответа.';
    if (slide.options.some((option) => !option.text.trim()))
      return 'Заполните все варианты ответа.';
    const options = slide.options.map((option) =>
      option.text.trim().replace(/\s+/g, ' ').toLocaleLowerCase('ru-RU'),
    );
    if (new Set(options).size !== options.length) return 'Варианты ответа должны отличаться.';
  }
  if (slide.type === 'pulse' && (!slide.minLabel.trim() || !slide.maxLabel.trim()))
    return 'Заполните подписи крайних оценок.';
  return null;
}
