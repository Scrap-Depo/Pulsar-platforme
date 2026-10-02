import { PublicResponse, Response, Round } from '../types/live';

export type ExportResponse = Pick<
  Response,
  'value' | 'displayValue' | 'moderation' | 'likes' | 'revision'
>;
export type ResultsExport = {
  title: string;
  exportedAt: string;
  rounds: Array<Round & { answeredCount: number; responses: ExportResponse[] }>;
};

export function historyResults(round: Round, responses: Response[]): PublicResponse[] {
  const text = round.slide.type === 'open-answers' || round.slide.type === 'word-cloud';
  return responses
    .filter((response) => !text || response.moderation === 'approved')
    .map((response) => ({
      id: response.id,
      type: response.type,
      value: response.displayValue ?? response.value,
      edited: response.displayValue != null,
      likes: response.likes,
      revision: response.revision,
    }));
}

export function answerLabel(round: Round, value: string | number) {
  if (round.slide.type === 'multiple-choice')
    return round.slide.options.find((option) => option.id === value)?.text ?? String(value);
  return String(value);
}

const moderationLabels = {
  approved: 'Одобрено',
  pending: 'На проверке',
  hidden: 'Скрыто',
};
export function moderationLabel(value: Response['moderation']) {
  return moderationLabels[value] ?? 'Статус неизвестен';
}

// Quoting alone does not prevent a spreadsheet from evaluating an answer as a formula.
function csvCell(value: string | number) {
  const raw = String(value);
  const safe = /^[\s\uFEFF]*[=+@-]/u.test(raw) || /^[\t\r\n]/u.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function resultsCsv(data: ResultsExport) {
  const rows: Array<Array<string | number>> = [
    [
      'Встреча',
      'Выгружено',
      'Вопрос',
      'Запущен',
      'Ответ',
      'Исходный ответ',
      'Статус',
      'Лайков',
      'Версия ответа',
      'Ответили на вопрос',
      'Всего ответов',
    ],
  ];
  for (const round of data.rounds) {
    for (const response of round.responses) {
      rows.push([
        data.title,
        data.exportedAt,
        round.slide.title,
        round.createdAt ?? '',
        answerLabel(round, response.displayValue ?? response.value),
        answerLabel(round, response.value),
        moderationLabel(response.moderation),
        response.likes,
        response.revision,
        round.answeredCount,
        round.responses.length,
      ]);
    }
    if (!round.responses.length) {
      rows.push([
        data.title,
        data.exportedAt,
        round.slide.title,
        round.createdAt ?? '',
        '',
        '',
        '',
        '',
        '',
        round.answeredCount,
        0,
      ]);
    }
  }
  // BOM and semicolon delimiter keep Cyrillic and columns readable in Russian Excel.
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(';')).join('\r\n')}\r\n`;
}

export function downloadCsv(data: ResultsExport, name: string) {
  const url = URL.createObjectURL(new Blob([resultsCsv(data)], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
