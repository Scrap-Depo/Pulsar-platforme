import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const compiled = await build({
  entryPoints: ['src/shared/lib/meetingReport.ts'],
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
});
const { meetingReport } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`
);
const answer = (value, moderation = 'approved', extra = {}) => ({
  value,
  moderation,
  displayValue: null,
  likes: 0,
  revision: 1,
  ...extra,
});
const round = (id, type, responses, extra = {}) => ({
  id,
  slide: { type, title: id, ...extra },
  createdAt: `2026-10-03T0${id}:00:00Z`,
  answeredCount: responses.length,
  responses,
});
const data = {
  title: 'Тестовая встреча',
  exportedAt: '2026-10-03T12:00:00Z',
  joinedCount: 3,
  rounds: [
    round('4', 'open-answers', [
      answer('PRIVATE_ORIGINAL', 'approved', { displayValue: 'APPROVED_EDIT', likes: 5 }),
      answer('PRIVATE_HIDDEN', 'hidden'),
      answer('PRIVATE_PENDING', 'pending'),
    ]),
    round('1', 'multiple-choice', [answer(1), answer(1), answer(2)], {
      options: [
        { id: 1, text: 'Развитие' },
        { id: 2, text: 'Поддержка' },
      ],
    }),
    round('2', 'pulse', [answer(7), answer(9)], { minLabel: 'Мало', maxLabel: 'Много' }),
    round('3', 'word-cloud', [
      answer('Команда'),
      answer('команда'),
      answer('HIDDEN_WORD', 'hidden'),
    ]),
  ],
};
test('shareable whole-meeting report orders every launch and includes summaries without private text or identity', () => {
  const report = meetingReport(data),
    serialized = JSON.stringify(report);
  for (const value of [
    'APPROVED_EDIT',
    'Развитие',
    'Поддержка',
    'Средняя оценка: 8',
    'команда',
    'Одобрено: 1. Скрыто: 1. На проверке: 1.',
  ])
    assert.ok(serialized.includes(value), value);
  for (const value of [
    'PRIVATE_ORIGINAL',
    'PRIVATE_HIDDEN',
    'PRIVATE_PENDING',
    'HIDDEN_WORD',
    'participantId',
    'requestId',
  ])
    assert.equal(serialized.includes(value), false, value);
  assert.deepEqual(
    report.content.filter((n) => n.pageBreak === 'before').map((n) => n.text),
    ['1. 1', '2. 2', '3. 3', '4. 4'],
  );
  assert.ok(
    JSON.stringify(report.footer(1, 5)).includes('Пульсар — платформа интерактивных опросов'),
  );
  assert.ok(serialized.includes('Распределение'));
});
test('internal report explicitly includes originals and statuses while default report never does', () => {
  const serialized = JSON.stringify(meetingReport(data, true));
  for (const value of [
    'PRIVATE_ORIGINAL',
    'PRIVATE_HIDDEN',
    'PRIVATE_PENDING',
    'HIDDEN_WORD',
    'Внутренний отчёт ведущего',
  ])
    assert.ok(serialized.includes(value), value);
  assert.equal(
    JSON.stringify(meetingReport({ ...data, rounds: [] })).includes('Проведённых вопросов нет.'),
    true,
  );
});
