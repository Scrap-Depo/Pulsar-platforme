import { useEffect, useState } from 'react';
import { command, message } from '../shared/lib/liveApi';
import { Meeting } from '../shared/types/live';

type Policy = NonNullable<Meeting['contentPolicy']>;
type Template = Policy & { id: string; name: string };
export default function FilterTemplates({
  policy,
  disabled,
  onApply,
}: {
  policy: Policy;
  disabled: boolean;
  onApply: (policy: Policy) => void;
}) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selected, setSelected] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function run(operation: 'list' | 'save' | 'delete') {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await command<{ templates: Template[] }>('filterTemplates', {
        operation,
        id: operation === 'delete' ? selected : crypto.randomUUID(),
        name,
        policy,
      });
      setTemplates(result.templates);
      setLoaded(true);
      if (operation === 'save') {
        const entry = result.templates.find(
          (t) => t.name.toLocaleLowerCase('ru-RU') === name.trim().toLocaleLowerCase('ru-RU'),
        );
        setSelected(entry?.id ?? '');
        setNotice('Набор сохранён в аккаунте. Фильтр текущей встречи сохраняется отдельно.');
      } else if (operation === 'delete') {
        setSelected('');
        setName('');
        setNotice('Набор удалён из аккаунта. Фильтры встреч остались прежними.');
      }
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void run('list');
  }, []);
  return (
    <details>
      <summary>Мои наборы фильтра</summary>
      <p>
        Наборы доступны в вашем аккаунте на других устройствах. Выбор набора не меняет встречу
        автоматически.
      </p>
      <fieldset disabled={disabled || busy}>
        <label>
          Сохранённый набор
          <select
            value={selected}
            onChange={(e) => {
              setSelected(e.target.value);
              setName(templates.find((t) => t.id === e.target.value)?.name ?? '');
              setNotice('');
            }}
          >
            <option value="">Выберите набор</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <div className="button-row">
          <button
            disabled={!selected}
            onClick={() => {
              const template = templates.find((t) => t.id === selected);
              if (template) {
                onApply(template);
                setNotice('Набор загружен в поля. Проверьте списки и сохраните фильтр встречи.');
              }
            }}
          >
            Загрузить набор в поля
          </button>
          <button
            disabled={!selected}
            onClick={() => {
              if (
                window.confirm('Удалить набор из аккаунта? Фильтры существующих встреч сохранятся.')
              )
                void run('delete');
            }}
          >
            Удалить набор
          </button>
        </div>
        <label>
          Название набора
          <input
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            placeholder="Например: командные встречи"
          />
        </label>
        <button disabled={!loaded || !name.trim()} onClick={() => void run('save')}>
          Сохранить набор в моём аккаунте
        </button>
        <p>Сохраняются оба списка из полей ниже. Набор с тем же именем обновится. До 20 наборов.</p>
        {error && (
          <>
            <p role="alert">{error}</p>
            <button onClick={() => void run('list')}>Обновить список наборов</button>
          </>
        )}
        {notice && <p role="status">{notice}</p>}
      </fieldset>
    </details>
  );
}
