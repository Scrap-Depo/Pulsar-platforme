import { useState } from 'react';
import { useLiveList, useOnline } from '../shared/hooks/useLiveData';
import { command, download, message } from '../shared/lib/liveApi';
import {
  answerLabel,
  downloadCsv,
  historyResults,
  moderationLabel,
  ResultsExport,
} from '../shared/lib/resultExport';
import { Response, Round } from '../shared/types/live';
import LiveResults from './LiveResults';

export default function RoundHistory({ sessionId, round }: { sessionId: string; round?: Round }) {
  const responses = useLiveList<Response>(
    round ? `meetings/${sessionId}/rounds/${round.id}/responses` : null,
  );
  const online = useOnline();
  const [busy, setBusy] = useState(false);
  const [exportError, setExportError] = useState<{ roundId: string; text: string } | null>(null);
  if (!round) return null;
  const selectedRound = round;
  const text = round.slide.type === 'open-answers' || round.slide.type === 'word-cloud';
  const results = historyResults(round, responses.data);
  async function exportResults(format: 'csv' | 'json') {
    setBusy(true);
    setExportError(null);
    try {
      const data = await command<ResultsExport>('export', { sessionId, roundId: selectedRound.id });
      const filename = `pulsar-${sessionId}-${selectedRound.id}`;
      if (format === 'csv') downloadCsv(data, `${filename}.csv`);
      else download(data, `${filename}.json`);
    } catch (error) {
      setExportError({ roundId: selectedRound.id, text: message(error) });
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <h3>{round.slide.title}</h3>
      <p>
        Ответили: {new Set(responses.data.map((response) => response.participantId)).size}. Ответов:{' '}
        {responses.data.length}.
      </p>
      {text && (
        <p>
          Одобрено: {responses.data.filter((response) => response.moderation === 'approved').length}
          . Скрыто: {responses.data.filter((response) => response.moderation === 'hidden').length}.{' '}
          На проверке:{' '}
          {responses.data.filter((response) => response.moderation === 'pending').length}.
        </p>
      )}
      {responses.error && <p role="alert">{responses.error}</p>}
      {!responses.loaded && <p role="status">Загружаем ответы…</p>}
      {responses.loaded && !responses.error && (
        <>
          {text && <p>В итогах показаны только одобренные ответы с редакцией ведущего.</p>}
          <section aria-label="Итоги выбранного вопроса">
            <LiveResults
              round={{ ...round, visible: true }}
              results={results}
              emptyMessage={
                text && responses.data.length ? 'Одобренных ответов пока нет.' : 'Ответов пока нет.'
              }
            />
          </section>
          <details>
            <summary>Все ответы (видны только ведущему)</summary>
            {responses.data.length === 0 && <p>Ответов пока нет.</p>}
            {responses.data.map((response) => (
              <p key={response.id}>
                {answerLabel(round, response.value)}
                {response.displayValue != null &&
                  ` — редакция: ${answerLabel(round, response.displayValue)}`}
                {text && ` — ${moderationLabel(response.moderation)}`}
              </p>
            ))}
          </details>
        </>
      )}
      <div className="button-row">
        <button
          disabled={busy || !online || round.phase !== 'closed'}
          onClick={() => void exportResults('csv')}
        >
          Скачать ответы вопроса CSV
        </button>
        <button
          disabled={busy || !online || round.phase !== 'closed'}
          onClick={() => void exportResults('json')}
        >
          Скачать ответы вопроса JSON
        </button>
      </div>
      <p>
        {round.phase !== 'closed'
          ? 'Выгрузка вопроса доступна после завершения сбора ответов. '
          : ''}
        CSV открывается в таблице. Выгрузка включает все ответы и их статусы, в том числе скрытые.
      </p>
      {busy && <p role="status">Подготавливаем выгрузку…</p>}
      {exportError?.roundId === round.id && <p role="alert">{exportError.text}</p>}
    </div>
  );
}
