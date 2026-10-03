import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterReasons, contentPolicy } from '../functions/content-filter.mjs';

test('Russian profanity and obvious evasions are held, ordinary word fragments are not', () => {
  for (const text of [
    'блядь',
    'ХУЙ',
    'пиздец',
    'заебал',
    'ёбаный',
    'долбоёб',
    'х у й',
    'х.у.й',
    'это х.у.й вообще',
  ]) {
    assert.ok(filterReasons(text).includes('Нецензурная лексика'), text);
  }
  for (const text of [
    'Поддержка команды',
    'Страхуй коллегу',
    'Подстрахуй команду',
    'Ребёнок',
    'Сухой результат',
    'Выбор продукта',
    'Для выбора продукта',
  ]) {
    assert.deepEqual(filterReasons(text), [], text);
  }
});

test('sensitive themes trigger review even when discussed neutrally, not a claim of intent', () => {
  assert.deepEqual(filterReasons('Обсудим политику компании'), []);
  assert.ok(filterReasons('Как предотвратить терроризм?').includes('Терроризм или угрозы насилия'));
  assert.ok(filterReasons('Взорвать школу').includes('Терроризм или угрозы насилия'));
  assert.deepEqual(filterReasons(7), []);
});

test('business phrase exceptions do not excuse unrelated politics, profanity or threats', () => {
  for (const text of [
    'Политика компании',
    'Обсудим политику конфиденциальности',
    'Правила политики безопасности',
  ])
    assert.deepEqual(filterReasons(text), []);
  assert.ok(filterReasons('Политика компании и выборы президента').includes('Политическая тема'));
  assert.ok(filterReasons('Политика компании блядь').includes('Нецензурная лексика'));
  const policy = contentPolicy({ allowedPhrases: ['Президент компании'] });
  assert.deepEqual(filterReasons('Президент компании выступил', policy), []);
  assert.ok(
    filterReasons('Президент компании и президент страны', policy).includes('Политическая тема'),
  );
  assert.ok(
    filterReasons('Президент компании хочет взорвать школу', policy).includes(
      'Терроризм или угрозы насилия',
    ),
  );
});

test('meeting-specific words are normalized literal whole words and always require review', () => {
  const policy = contentPolicy({
    blockedWords: ['Кот', 'секретный проект', 'СЕМЁНОВ', 'кот'],
    allowedPhrases: ['политика компании'],
  });
  assert.equal(policy.blockedWords.length, 3);
  assert.deepEqual(filterReasons('который ответил', policy), []);
  assert.deepEqual(filterReasons('Семёнов и секретный   проект', policy, false), [
    'Запрещённое слово встречи',
  ]);
  assert.deepEqual(filterReasons('Есть кот.', policy), ['Запрещённое слово встречи']);
  assert.deepEqual(filterReasons('с+++', contentPolicy({ blockedWords: ['c++'] })), []);
  assert.deepEqual(filterReasons('код c++ здесь', contentPolicy({ blockedWords: ['c++'] })), [
    'Запрещённое слово встречи',
  ]);
  assert.deepEqual(
    filterReasons(
      'Политика компании',
      contentPolicy({ blockedWords: ['политика компании'], allowedPhrases: ['политика компании'] }),
    ),
    ['Запрещённое слово встречи'],
  );
  for (const bad of [
    null,
    [],
    { blockedWords: 'bad' },
    { blockedWords: [''] },
    { blockedWords: ['x'.repeat(81)] },
    { blockedWords: Array(101).fill('word') },
  ])
    assert.throws(() => contentPolicy(bad));
});
