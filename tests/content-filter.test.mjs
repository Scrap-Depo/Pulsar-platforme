import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterReasons } from '../functions/content-filter.mjs';

test('Russian profanity and obvious evasions are held, ordinary word fragments are not', () => {
  for (const text of ['блядь', 'ХУЙ', 'пиздец', 'заебал', 'ёбаный', 'х у й', 'х.у.й']) {
    assert.ok(filterReasons(text).includes('Нецензурная лексика'), text);
  }
  for (const text of [
    'Поддержка команды',
    'Страхуй коллегу',
    'Подстрахуй команду',
    'Ребёнок',
    'Сухой результат',
    'Выбор продукта',
  ]) {
    assert.deepEqual(filterReasons(text), [], text);
  }
});

test('sensitive themes trigger review even when discussed neutrally, not a claim of intent', () => {
  assert.deepEqual(filterReasons('Обсудим политику компании'), ['Политическая тема']);
  assert.ok(filterReasons('Как предотвратить терроризм?').includes('Терроризм или угрозы насилия'));
  assert.ok(filterReasons('Взорвать школу').includes('Терроризм или угрозы насилия'));
  assert.deepEqual(filterReasons(7), []);
});
