import LikeCount from '../shared/ui/LikeCount';
import { PublicResponse, Round } from '../shared/types/live';
import MultipleChoiceProjector from '../features/multiple-choice/components/MultipleChoiceProjector';
import PulseProjector from '../features/pulse/components/PulseProjector';
import WordCloudProjector from '../features/word-cloud/components/WordCloudProjector';
import { mergeParticipantWord } from '../features/word-cloud/model/utils';
import { WordCloudItem } from '../features/word-cloud/model/types';
export default function LiveResults({
  round,
  results,
  emptyMessage = 'Опубликованных ответов пока нет.',
  onResponseSelect,
}: {
  round: Round;
  results: PublicResponse[];
  emptyMessage?: string;
  onResponseSelect?: (id: string) => void;
}) {
  const slide = round.slide;
  if (!round.visible)
    return (
      <div className="card live-results">
        <h2>{slide.title}</h2>
      </div>
    );
  if (!results.length)
    return (
      <div className="card live-results waiting-results">
        <h2>{slide.title}</h2>
        <div className="pulse-ring" aria-hidden="true" />
        <p>{emptyMessage}</p>
      </div>
    );
  if (slide.type === 'multiple-choice')
    return (
      <MultipleChoiceProjector
        question={slide.title}
        options={slide.options.map((o) => ({
          ...o,
          votes: results.filter((r) => r.value === o.id).length,
        }))}
        visualization={slide.visualization}
        resultDisplay={slide.resultDisplay}
      />
    );
  if (slide.type === 'pulse') {
    const distribution = Object.fromEntries(
      Array.from({ length: 10 }, (_, i) => [
        i + 1,
        results.filter((r) => r.value === i + 1).length,
      ]),
    );
    return (
      <div>
        <p>Ответили: {results.length}</p>
        <PulseProjector
          title={slide.title}
          minLabel={slide.minLabel}
          maxLabel={slide.maxLabel}
          value={0}
          projectorView={slide.projectorView}
          distribution={distribution}
          visualization={slide.visualization}
          metricDisplay="average"
        />
      </div>
    );
  }
  if (slide.type === 'word-cloud') {
    const words = results.reduce<WordCloudItem[]>(
      (list, item) => mergeParticipantWord(list, String(item.value), slide.useAI),
      [],
    );
    return (
      <WordCloudProjector
        title={slide.title}
        words={words}
        participantWord=""
        visualization={slide.visualization}
      />
    );
  }
  const ranked = [...results].sort((a, b) => b.likes - a.likes || a.id.localeCompare(b.id));
  const density = ranked.length <= 2 ? 'few' : ranked.length <= 6 ? 'some' : 'many';
  return (
    <section className="live-results answer-wall" data-density={density}>
      <h2>{slide.title}</h2>
      <p className="result-summary" key={results.length}>
        Опубликовано карточек: {results.length}
      </p>
      <div className="answer-grid">
        {ranked.map((r, i) => (
          <article
            className={`card answer-card tone-${i % 5}${i === 0 && r.likes > 0 ? ' is-leader' : ''}`}
            key={r.id}
          >
            {i === 0 && r.likes > 0 && <span className="leader-badge">Лидирует</span>}
            {onResponseSelect ? (
              <button
                className="host-answer-action result-answer-text"
                onClick={() => onResponseSelect(r.id)}
                aria-label={`Действия с карточкой: ${r.value}`}
              >
                {r.value}
              </button>
            ) : (
              <p className="result-answer-text">{r.value}</p>
            )}
            {r.edited && <small>Отредактировано ведущим</small>}
            <LikeCount count={r.likes} />
          </article>
        ))}
      </div>
    </section>
  );
}
