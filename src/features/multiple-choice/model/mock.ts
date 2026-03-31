import { MultipleChoiceQuestion } from './types';

export const multipleChoiceMock: MultipleChoiceQuestion = {
  title: 'Какой ваш главный приоритет на этот год?',
  options: [
    { id: 1, text: 'Запуск нового продукта', votes: 42, color: 'linear-gradient(135deg, #479ddb, #3363c1)' },
    { id: 2, text: 'Оптимизация расходов', votes: 15, color: 'linear-gradient(135deg, #b7bfe0, #6f72c4)' },
    { id: 3, text: 'Найм новых сотрудников', votes: 28, color: 'linear-gradient(135deg, #c03654, #7f1d1d)' },
    { id: 4, text: 'Выход на новые рынки', votes: 8, color: 'linear-gradient(135deg, #31417b, #0a0a21)' },
  ],
};
