import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  responseValue,
  responseId,
  publicResponse,
  validSlide,
  settings,
} from '../functions/domain.mjs';
test('limits count Unicode characters, require explicit numeric choice', () => {
  assert.equal(responseValue({ type: 'open-answers' }, '😀'.repeat(300)), '😀'.repeat(300));
  assert.throws(() => responseValue({ type: 'open-answers' }, 'а'.repeat(301)));
  assert.throws(() => responseValue({ type: 'word-cloud' }, 'а'.repeat(41)));
  assert.throws(() => responseValue({ type: 'word-cloud' }, '  '));
  for (const value of ['', null, 0, 11, 3.5])
    assert.throws(() => responseValue({ type: 'pulse' }, value));
  assert.equal(responseValue({ type: 'pulse' }, 5), 5);
  assert.throws(() => responseValue({ type: 'multiple-choice', options: [{ id: 1 }] }, 2));
});
test('stable per-participant slot IDs isolate rounds and members', () => {
  assert.equal(responseId('r', 'u', 0), responseId('r', 'u', 0));
  assert.notEqual(responseId('r', 'u', 0), responseId('r', 'u', 1));
  assert.notEqual(responseId('r', 'u', 0), responseId('r2', 'u', 0));
  assert.notEqual(responseId('r', 'u', 0), responseId('r', 'u2', 0));
});
test('published response omits identity, original and history', () => {
  const result = publicResponse({
    id: 'r',
    participantId: 'private',
    value: 'original',
    displayValue: 'edited',
    history: ['private'],
    type: 'open-answers',
    revision: 1,
  });
  assert.equal(result.value, 'edited');
  assert.equal(result.edited, true);
  assert.equal('participantId' in result, false);
  assert.equal('history' in result, false);
});
test('invalid option identifiers rejected and safe defaults applied', () => {
  assert.deepEqual(settings(), { cardLimit: 1, moderation: true, immediate: false });
  assert.throws(() =>
    validSlide({
      id: 's',
      title: 'Question',
      type: 'multiple-choice',
      options: [
        { id: 1, text: 'a' },
        { id: 1, text: 'b' },
      ],
    }),
  );
});
