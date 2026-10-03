import { useState } from 'react';
import { Meeting } from '../shared/types/live';

export default function MeetingReportNotes({
  notes,
  disabled,
  onSave,
}: {
  notes: Meeting['reportNotes'];
  disabled: boolean;
  onSave: (notes: NonNullable<Meeting['reportNotes']>) => Promise<boolean>;
}) {
  const [conclusions, setConclusions] = useState(notes?.conclusions ?? '');
  const [agreements, setAgreements] = useState(notes?.agreements ?? '');
  const [changed, setChanged] = useState(false);
  const invalid = [conclusions, agreements].some((text) => [...text.trim()].length > 4000);
  return (
    <details>
      <summary>Выводы и договорённости для PDF</summary>
      <p>
        Ваши заметки сохраняются во встрече и включаются в PDF отдельным разделом ведущего. Они не
        показываются участникам и на проекторе. Можно дополнить после завершения встречи.
      </p>
      <fieldset disabled={disabled}>
        <label>
          Выводы ведущего
          <textarea
            rows={5}
            value={conclusions}
            onChange={(e) => {
              setConclusions(e.target.value);
              setChanged(true);
            }}
            placeholder="Что показали ответы? Какие выводы вы делаете?"
          />
        </label>
        <label>
          Договорённости и следующие шаги
          <textarea
            rows={5}
            value={agreements}
            onChange={(e) => {
              setAgreements(e.target.value);
              setChanged(true);
            }}
            placeholder="Что делаем, кто отвечает и к какому сроку?"
          />
        </label>
        <p>До 4000 символов в каждом поле. Перед скачиванием PDF сохраните заметки.</p>
        <button
          disabled={!changed || invalid}
          onClick={() =>
            void onSave({ conclusions, agreements, version: notes?.version ?? 0 }).then((ok) => {
              if (ok) setChanged(false);
            })
          }
        >
          Сохранить выводы и договорённости
        </button>
        {invalid && <p role="alert">Сократите каждое поле до 4000 символов.</p>}
        {changed && <p role="status">Есть несохранённые заметки. Они пока не попадут в PDF.</p>}
      </fieldset>
    </details>
  );
}
