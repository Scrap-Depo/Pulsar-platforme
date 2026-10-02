import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

// Transpile the browser's pure formatter without importing Firebase or the DOM.
const source = await readFile(
  new URL('../src/shared/lib/resultExport.ts', import.meta.url),
  'utf8',
);
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText;
const { historyResults, resultsCsv } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`
);
const round = {
  id: 'round-1',
  slide: { type: 'open-answers', title: 'Что изменим?' },
  phase: 'closed',
  visible: false,
  createdAt: '2026-10-02T00:00:00.000Z',
};
const answer = {
  id: 'answer-1',
  participantId: 'private-person',
  requestId: 'private-request',
  type: 'open-answers',
  value: 'Исходный ответ',
  displayValue: 'Редакция ведущего',
  moderation: 'approved',
  likes: 2,
  revision: 3,
};
function data(responses, selectedRound = round) {
  return {
    title: 'Встреча',
    exportedAt: '2026-10-02T01:00:00.000Z',
    rounds: [{ ...selectedRound, answeredCount: 1, responses }],
  };
}

test('history charts use approved edited text and omit private fields without changing visibility', () => {
  const result = historyResults(round, [
    answer,
    { ...answer, id: 'hidden', moderation: 'hidden' },
    { ...answer, id: 'pending', moderation: 'pending' },
  ]);
  assert.deepEqual(result, [
    {
      id: answer.id,
      type: answer.type,
      value: answer.displayValue,
      edited: true,
      likes: 2,
      revision: 3,
    },
  ]);
  assert.equal(round.visible, false);
  const numeric = { ...round, slide: { type: 'pulse', title: 'Оценка' } };
  assert.equal(
    historyResults(numeric, [{ ...answer, moderation: 'hidden', value: 7, displayValue: null }])
      .length,
    1,
  );
});

test('CSV retains edited and original text with status while excluding personal identifiers', () => {
  const csv = resultsCsv(data([answer]));
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('"Редакция ведущего";"Исходный ответ";"Одобрено";"2";"3"'));
  assert.ok(!csv.includes('private-person'));
  assert.ok(!csv.includes('private-request'));
  assert.ok(!csv.includes('answer-1'));
});

test('CSV escapes semicolons, quotes and line breaks and neutralizes spreadsheet formulas', () => {
  const csv = resultsCsv(
    data([
      { ...answer, value: 'строка; "кавычки"\nновая', displayValue: null },
      { ...answer, value: ' =HYPERLINK("x")', displayValue: null },
      { ...answer, value: '\t=1+1', displayValue: null },
    ]),
  );
  assert.ok(csv.includes('"строка; ""кавычки""\nновая"'));
  assert.ok(csv.includes('"\' =HYPERLINK(""x"")"'));
  assert.ok(csv.includes('"\'\t=1+1"'));
});

test('CSV uses option names instead of IDs and represents an empty question', () => {
  const multipleChoice = {
    ...round,
    slide: {
      type: 'multiple-choice',
      title: 'Выбор',
      options: [{ id: 'option-secret', text: 'Развитие' }],
    },
  };
  const csv = resultsCsv(
    data([{ ...answer, value: 'option-secret', displayValue: null }], multipleChoice),
  );
  assert.ok(csv.includes('"Развитие";"Развитие"'));
  assert.ok(!csv.includes('option-secret'));
  const empty = resultsCsv(data([]));
  assert.ok(empty.includes('"Что изменим?"'));
  assert.equal(empty.split('\r\n').length, 3);
});
