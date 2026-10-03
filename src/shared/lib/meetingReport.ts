import type { Content, TDocumentDefinitions, TableCell } from 'pdfmake/interfaces';
import { ResultsExport, answerLabel, moderationLabel } from './resultExport';

const brand = 'Пульсар — платформа интерактивных опросов';
const date = (value?: string) =>
  value ? new Date(value).toLocaleString('ru-RU') : 'Дата не указана';
const types = {
  'multiple-choice': 'Голосование',
  pulse: 'Шкала',
  'word-cloud': 'Облако слов',
  'open-answers': 'Открытые ответы',
};
function bar(count: number, max: number): TableCell {
  return {
    canvas: [
      { type: 'rect', x: 0, y: 3, w: 80, h: 9, color: '#e6f3f7' },
      ...(count > 0
        ? [
            {
              type: 'rect' as const,
              x: 0,
              y: 3,
              w: max ? (80 * count) / max : 0,
              h: 9,
              color: '#0e7490',
            },
          ]
        : []),
    ],
  };
}
function table(headers: string[], rows: TableCell[][]): Content {
  return {
    table: {
      headerRows: 1,
      widths: headers.map((_, i) =>
        i === 0 || (i === 1 && headers[0] === 'Исходный ответ') ? '*' : 'auto',
      ),
      body: [headers.map((text) => ({ text, bold: true, fillColor: '#e6f3f7' })), ...rows],
    },
    layout: 'lightHorizontalLines',
    margin: [0, 10, 0, 16],
  };
}
export function meetingReport(data: ResultsExport, includePrivate = false): TDocumentDefinitions {
  const rounds = [...data.rounds].sort(
    (a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? '') || a.id.localeCompare(b.id),
  );
  const content: Content[] = [
    { text: brand, color: '#0e7490', fontSize: 12, margin: [0, 0, 0, 18] },
    { text: data.title, fontSize: 24, bold: true, margin: [0, 0, 0, 12] },
    { text: `Отчёт по всей встрече · ${date(data.exportedAt)}`, margin: [0, 0, 0, 8] },
    {
      text: `Проведено вопросов: ${rounds.length}. Ответов: ${rounds.reduce((sum, r) => sum + r.responses.length, 0)}.${data.joinedCount !== undefined ? ` Участников: ${data.joinedCount}.` : ''}`,
      margin: [0, 0, 0, 12],
    },
    {
      text: includePrivate
        ? 'Внутренний отчёт ведущего. Включены исходные, скрытые и ожидающие ответы. Не предназначен для передачи участникам.'
        : 'В текстовых итогах показаны только одобренные редакции. Скрытые и ожидающие ответы учитываются в сводке, их текст не включён.',
      color: '#526271',
      margin: [0, 0, 0, 16],
    },
  ];
  const notes = data.reportNotes;
  if (notes?.conclusions?.trim() || notes?.agreements?.trim()) {
    content.push({
      text: 'Выводы и договорённости ведущего',
      fontSize: 18,
      bold: true,
      margin: [0, 16, 0, 12],
    });
    for (const [title, value] of [
      ['Выводы ведущего', notes.conclusions],
      ['Договорённости и следующие шаги', notes.agreements],
    ]) {
      if (!value?.trim()) continue;
      content.push({ text: title, bold: true, margin: [0, 10, 0, 6] });
      content.push({ text: value.trim(), margin: [0, 0, 0, 10] });
    }
  }
  if (!rounds.length) content.push({ text: 'Проведённых вопросов нет.' });
  rounds.forEach((round, index) => {
    const text = ['word-cloud', 'open-answers'].includes(round.slide.type);
    const published = round.responses.filter((r) => !text || r.moderation === 'approved');
    content.push({
      text: `${index + 1}. ${round.slide.title}`,
      fontSize: 18,
      bold: true,
      pageBreak: 'before',
      margin: [0, 0, 0, 8],
    });
    content.push({
      text: `${types[round.slide.type]} · Запуск: ${date(round.createdAt)}`,
      color: '#526271',
      margin: [0, 0, 0, 8],
    });
    content.push({ text: `Ответили: ${round.answeredCount}. Ответов: ${round.responses.length}.` });
    if (text)
      content.push({
        text: `Одобрено: ${published.length}. Скрыто: ${round.responses.filter((r) => r.moderation === 'hidden').length}. На проверке: ${round.responses.filter((r) => r.moderation === 'pending').length}.`,
        margin: [0, 4, 0, 8],
      });
    if (round.slide.type === 'multiple-choice') {
      const total = round.responses.length;
      content.push(
        table(
          ['Вариант ответа', 'Голосов', 'Доля', 'Распределение'],
          round.slide.options.map((option) => {
            const count = round.responses.filter((r) => r.value === option.id).length;
            return [
              option.text,
              String(count),
              `${total ? Math.round((count * 1000) / total) / 10 : 0}%`,
              bar(count, total),
            ];
          }),
        ),
      );
    } else if (round.slide.type === 'pulse') {
      const values = round.responses.map((r) => Number(r.value)).filter(Number.isFinite);
      content.push({
        text: values.length
          ? `Средняя оценка: ${(values.reduce((sum, n) => sum + n, 0) / values.length).toLocaleString('ru-RU', { maximumFractionDigits: 2 })}.`
          : 'Оценок пока нет.',
        margin: [0, 8, 0, 4],
      });
      content.push({ text: `${round.slide.minLabel} — ${round.slide.maxLabel}`, color: '#526271' });
      content.push(
        table(
          ['Оценка', 'Ответов', 'Распределение'],
          Array.from({ length: 10 }, (_, i) => [
            String(i + 1),
            String(values.filter((n) => n === i + 1).length),
            bar(values.filter((n) => n === i + 1).length, values.length),
          ]),
        ),
      );
    } else if (round.slide.type === 'word-cloud') {
      const words = new Map<string, number>();
      for (const response of published) {
        const word = String(response.displayValue ?? response.value)
          .trim()
          .toLocaleLowerCase('ru-RU');
        words.set(word, (words.get(word) ?? 0) + 1);
      }
      if (words.size)
        content.push(
          table(
            ['Слово или фраза', 'Ответов'],
            [...words]
              .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ru'))
              .map(([word, count]) => [word, String(count)]),
          ),
        );
      else content.push({ text: 'Одобренных ответов нет.', margin: [0, 12, 0, 12] });
    } else {
      if (published.length)
        content.push(
          table(
            ['Ответ', 'Лайков'],
            [...published]
              .sort((a, b) => b.likes - a.likes)
              .map((r) => [
                String(r.displayValue ?? r.value) +
                  (r.displayValue != null ? ' (редакция ведущего)' : ''),
                String(r.likes),
              ]),
          ),
        );
      else content.push({ text: 'Одобренных ответов нет.', margin: [0, 12, 0, 12] });
    }
    if (includePrivate && text) {
      content.push({ text: 'Все ответы — только для ведущего', bold: true, margin: [0, 12, 0, 8] });
      if (round.responses.length)
        content.push(
          table(
            ['Исходный ответ', 'Редакция', 'Статус', 'Лайков'],
            round.responses.map((r) => [
              answerLabel(round, r.value),
              r.displayValue != null ? answerLabel(round, r.displayValue) : '—',
              moderationLabel(r.moderation),
              String(r.likes),
            ]),
          ),
        );
    }
  });
  return {
    pageSize: 'A4',
    pageMargins: [40, 40, 40, 50],
    defaultStyle: { font: 'Roboto', fontSize: 11, lineHeight: 1.25 },
    info: {
      title: data.title,
      author: brand,
      subject: 'Результаты интерактивной встречи',
      creator: 'Пульсар',
    },
    content,
    footer: (page, total) => ({
      columns: [
        { text: brand, color: '#526271' },
        { text: `${page} / ${total}`, alignment: 'right' },
      ],
      fontSize: 8,
      margin: [40, 14, 40, 0],
    }),
  };
}
