import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  responseValue,
  responseId,
  publicResponse,
  validSlide,
  settings,
  launchSettings,
  launchProblem,
  joinCode,
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
  assert.deepEqual(settings(), {
    cardLimit: 1,
    moderation: false,
    immediate: false,
    showOnPhones: false,
  });
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

test('drafts permit blank content, while launch rejects blanks and normalized duplicate options', () => {
  const draft = validSlide({
    id: 'draft',
    type: 'multiple-choice',
    title: '',
    options: [
      { id: 1, text: '' },
      { id: 2, text: '' },
    ],
  });
  assert.match(launchProblem(draft), /текст вопроса/);
  draft.title = 'Выбор';
  assert.match(launchProblem(draft), /все варианты/);
  draft.options = [
    { id: 1, text: ' Новый  продукт ' },
    { id: 2, text: 'новый продукт' },
  ];
  assert.match(launchProblem(draft), /отличаться/);
  draft.options[1].text = 'Расходы';
  assert.equal(launchProblem(draft), null);
  assert.throws(() => validSlide({ ...draft, title: 5 }));
  assert.throws(() =>
    validSlide({
      ...draft,
      options: [
        { id: 1, text: null },
        { id: 2, text: 'OK' },
      ],
    }),
  );
});
test('slide allowlist strips arbitrary fields and launch settings are safe and type-aware', () => {
  const slide = validSlide({
    id: 's',
    title: 'Word',
    type: 'word-cloud',
    secret: 'discard',
    options: [],
    launch: { cardLimit: 3, moderation: false, immediate: true, extra: 'discard' },
  });
  assert.equal('secret' in slide, false);
  assert.equal('options' in slide, false);
  assert.deepEqual(slide.launch, {
    cardLimit: 1,
    moderation: false,
    immediate: true,
    showOnPhones: false,
  });
  assert.deepEqual(settings(null), settings());
  assert.deepEqual(settings('malformed'), settings());
  assert.deepEqual(launchSettings({ type: 'open-answers' }), {
    cardLimit: 1,
    moderation: false,
    immediate: true,
    showOnPhones: false,
  });
  assert.deepEqual(launchSettings({ type: 'multiple-choice' }, null), {
    cardLimit: 1,
    moderation: false,
    immediate: true,
    showOnPhones: false,
  });
  assert.deepEqual(validSlide({ id: 'old', title: 'Old', type: 'open-answers' }).launch, undefined);
  for (const launch of [
    null,
    'bad',
    [],
    { cardLimit: 99, moderation: 'false', immediate: 'true' },
  ]) {
    const normalized = validSlide({ id: 's', title: '', type: 'open-answers', launch }).launch;
    assert.equal(normalized.cardLimit, 1);
    assert.equal(normalized.moderation, false);
    assert.equal(normalized.immediate, true);
  }
});

test('readable new codes omit ambiguous characters and phone results default off', () => {
  for (let i = 0; i < 100; i++) assert.match(joinCode(), /^[2345679ACDEFGHJKLMNPQRSTUVWXYZ]{6}$/);
  assert.equal(settings({ showOnPhones: 'true' }).showOnPhones, false);
  assert.equal(settings({ showOnPhones: true }).showOnPhones, true);
});

test('unmoderated text launches immediately even when old timing says after', () => {
  assert.deepEqual(
    launchSettings({ type: 'word-cloud' }, { moderation: false, immediate: false }),
    {
      cardLimit: 1,
      moderation: false,
      immediate: true,
      showOnPhones: false,
    },
  );
});
