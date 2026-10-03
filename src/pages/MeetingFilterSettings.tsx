import { useState } from 'react';
import { Meeting } from '../shared/types/live';

type Policy = NonNullable<Meeting['contentPolicy']>;
export default function MeetingFilterSettings({
  policy,
  disabled,
  onSave,
}: {
  policy?: Policy;
  disabled: boolean;
  onSave: (policy: Policy) => Promise<boolean>;
}) {
  const [blocked, setBlocked] = useState(policy?.blockedWords.join('\n') ?? '');
  const [allowed, setAllowed] = useState(policy?.allowedPhrases.join('\n') ?? '');
  const [changed, setChanged] = useState(false);
  const list = (text: string) =>
    text
      .split('\n')
      .map((word) => word.trim())
      .filter(Boolean);
  const invalid = [list(blocked), list(allowed)].some(
    (words) => words.length > 100 || words.some((word) => [...word].length > 80),
  );
  return (
    <details className="card meeting-filter-settings">
      <summary>Фильтр ответов этой встречи</summary>
      <p>
        Деловые выражения «политика компании», «политика конфиденциальности» и подобные не
        задерживаются автоматически. Фильтр по словам может ошибаться.
      </p>
      <fieldset disabled={disabled}>
        <label>
          Запрещённые слова и фразы
          <textarea
            rows={4}
            value={blocked}
            placeholder="Каждое слово или фраза с новой строки"
            onChange={(e) => {
              setBlocked(e.target.value);
              setChanged(true);
            }}
          />
        </label>
        <p>
          Точное совпадение целого слова или фразы, без учёта регистра и различий «е/ё». «Кот» не
          запрещает «который». Список действует даже при выключенной общей модерации и фильтре тем:
          ответы ожидают одобрения.
        </p>
        <label>
          Исключения для политического фильтра
          <textarea
            rows={3}
            value={allowed}
            placeholder="Например: президент компании"
            onChange={(e) => {
              setAllowed(e.target.value);
              setChanged(true);
            }}
          />
        </label>
        <p>
          Исключается только указанная фраза, а не весь ответ. Мат, угрозы и ваши запрещённые слова
          продолжают проверяться. Для каждого списка: до 100 записей, до 80 символов в записи.
        </p>
        <button
          disabled={!changed || invalid}
          onClick={() =>
            void onSave({ blockedWords: list(blocked), allowedPhrases: list(allowed) }).then(
              (ok) => {
                if (ok) setChanged(false);
              },
            )
          }
        >
          Сохранить фильтр встречи
        </button>
        {invalid && <p role="alert">Сократите списки до 100 записей, каждую — до 80 символов.</p>}
      </fieldset>
      <p>
        После сохранения правила действуют на новые и изменённые ответы во всех вопросах этой
        встречи. Уже опубликованные и ожидающие ответы не пересматриваются автоматически.
      </p>
    </details>
  );
}
