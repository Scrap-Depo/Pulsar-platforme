import { Session, SessionSlide, SlideType } from '../types/common';
import { multipleChoiceMock } from '../../features/multiple-choice/model/mock';

export type SlideTemplate = {
  id: string;
  label: string;
  description: string;
  type: SlideType;
};

export const defaultSession: Session = {
  id: 'session-q1',
  title: 'Общая встреча команды',
  joinCode: 'PULSAR42',
  status: 'draft',
  currentSlideId: 'slide-priorities',
  liveSlideId: 'slide-priorities',
  slides: [
    {
      id: 'slide-priorities',
      title: multipleChoiceMock.title,
      type: 'multiple-choice',
      options: multipleChoiceMock.options,
      visualization: 'bar',
      resultDisplay: 'both',
    },
    {
      id: 'slide-insight',
      title: 'Главный инсайт квартала?',
      type: 'open-answers',
      allowLikes: true,
      visualization: 'cards',
    },
    {
      id: 'slide-pulse',
      title: 'Оцените текущее состояние по шкале от 1 до 10',
      type: 'pulse',
      minLabel: 'Скучно',
      maxLabel: 'Огонь!',
      projectorView: 'histogram',
      visualization: 'scale',
      metricDisplay: 'both',
    },
    {
      id: 'slide-cloud',
      title: 'Введите слово или короткую ассоциацию',
      type: 'word-cloud',
      useAI: true,
      visualization: 'cloud',
    },
  ],
};

export function findSlideById(slides: SessionSlide[], slideId: string | null) {
  if (!slideId) {
    return null;
  }

  return slides.find((slide) => slide.id === slideId) ?? null;
}

export const slideTitlePlaceholderMap: Record<SlideType, string> = {
  'multiple-choice': 'Например, Какой вариант берем в приоритет?',
  'open-answers': 'Например, Какой главный инсайт вы уносите?',
  pulse: 'Например, Насколько вам сейчас все понятно?',
  'word-cloud': 'Например, С каким словом у вас ассоциируется встреча?',
};

export const slideTemplates: SlideTemplate[] = [
  {
    id: 'template-icebreaker-cloud',
    label: 'Разогрев',
    description: 'Облако слов для быстрого разогрева аудитории',
    type: 'word-cloud',
  },
  {
    id: 'template-decision-vote',
    label: 'Выбор решения',
    description: 'Голосование по приоритетам или вариантам решения',
    type: 'multiple-choice',
  },
  {
    id: 'template-energy-pulse',
    label: 'Пульс аудитории',
    description: 'Быстрый замер энергии, ясности или настроения',
    type: 'pulse',
  },
  {
    id: 'template-retro-insight',
    label: 'Рефлексия',
    description: 'Открытая рефлексия с возможностью лайков',
    type: 'open-answers',
  },
];

export function createSlide(type: SlideType, _order: number): SessionSlide {
  const id = `slide-${type}-${Date.now()}`;
  const title = '';

  if (type === 'multiple-choice') {
    return {
      id,
      title,
      type,
      options: [
        { id: Date.now(), text: 'Вариант 1', votes: 0, color: 'linear-gradient(135deg, #479ddb, #3363c1)' },
        { id: Date.now() + 1, text: 'Вариант 2', votes: 0, color: 'linear-gradient(135deg, #b7bfe0, #6f72c4)' },
      ],
      visualization: 'bar',
      resultDisplay: 'both',
    };
  }

  if (type === 'open-answers') {
    return {
      id,
      title,
      type,
      allowLikes: true,
      visualization: 'cards',
    };
  }

  if (type === 'pulse') {
    return {
      id,
      title,
      type,
      minLabel: 'Скучно',
      maxLabel: 'Огонь!',
      projectorView: 'histogram',
      visualization: 'scale',
      metricDisplay: 'both',
    };
  }

  return {
    id,
    title,
    type,
    useAI: true,
    visualization: 'cloud',
  };
}

export function createTemplateSlide(templateId: string, order: number): SessionSlide {
  const timestamp = Date.now();

  switch (templateId) {
    case 'template-icebreaker-cloud':
      return {
        id: `slide-word-cloud-${timestamp}`,
        title: 'Одним словом: с чем вы пришли сегодня?',
        type: 'word-cloud',
        useAI: true,
        visualization: 'cloud',
      };
    case 'template-decision-vote':
      return {
        id: `slide-multiple-choice-${timestamp}`,
        title: 'Какой вариант берем в приоритет?',
        type: 'multiple-choice',
        visualization: 'donut',
        resultDisplay: 'both',
        options: [
          { id: timestamp, text: 'Вариант A', votes: 0, color: 'linear-gradient(135deg, #479ddb, #3363c1)' },
          { id: timestamp + 1, text: 'Вариант B', votes: 0, color: 'linear-gradient(135deg, #b7bfe0, #6f72c4)' },
          { id: timestamp + 2, text: 'Вариант C', votes: 0, color: 'linear-gradient(135deg, #c03654, #7f1d1d)' },
        ],
      };
    case 'template-energy-pulse':
      return {
        id: `slide-pulse-${timestamp}`,
        title: 'Насколько вам сейчас все понятно?',
        type: 'pulse',
        minLabel: 'Неясно',
        maxLabel: 'Очень ясно',
        projectorView: 'histogram',
        visualization: 'line',
        metricDisplay: 'both',
      };
    case 'template-retro-insight':
      return {
        id: `slide-open-answers-${timestamp}`,
        title: 'Какой главный инсайт вы уносите?',
        type: 'open-answers',
        allowLikes: true,
        visualization: 'wall',
      };
    default:
      return createSlide('multiple-choice', order);
  }
}

export function moveSlide(slides: SessionSlide[], slideId: string, direction: 'up' | 'down') {
  const index = slides.findIndex((slide) => slide.id === slideId);

  if (index === -1) {
    return slides;
  }

  const targetIndex = direction === 'up' ? index - 1 : index + 1;

  if (targetIndex < 0 || targetIndex >= slides.length) {
    return slides;
  }

  const nextSlides = [...slides];
  const [slide] = nextSlides.splice(index, 1);
  nextSlides.splice(targetIndex, 0, slide);
  return nextSlides;
}

export function reorderSlides(slides: SessionSlide[], draggedSlideId: string, targetSlideId: string) {
  const draggedIndex = slides.findIndex((slide) => slide.id === draggedSlideId);
  const targetIndex = slides.findIndex((slide) => slide.id === targetSlideId);

  if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex) {
    return slides;
  }

  const nextSlides = [...slides];
  const [draggedSlide] = nextSlides.splice(draggedIndex, 1);
  nextSlides.splice(targetIndex, 0, draggedSlide);
  return nextSlides;
}

export function removeSlide(slides: SessionSlide[], slideId: string) {
  if (slides.length <= 1) {
    return slides;
  }

  return slides.filter((slide) => slide.id !== slideId);
}

export function duplicateSlide(slides: SessionSlide[], slideId: string) {
  const index = slides.findIndex((slide) => slide.id === slideId);

  if (index === -1) {
    return slides;
  }

  const original = slides[index];
  const duplicated: SessionSlide =
    original.type === 'multiple-choice'
      ? {
          ...original,
          id: `slide-${original.type}-${Date.now()}`,
          title: `${original.title} копия`,
          options: original.options.map((option, optionIndex) => ({
            ...option,
            id: Date.now() + optionIndex,
            votes: 0,
          })),
        }
      : {
          ...original,
          id: `slide-${original.type}-${Date.now()}`,
          title: `${original.title} копия`,
        };

  const nextSlides = [...slides];
  nextSlides.splice(index + 1, 0, duplicated);
  return nextSlides;
}
