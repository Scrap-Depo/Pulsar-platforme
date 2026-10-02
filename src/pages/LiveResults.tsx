import { PublicResponse, Round } from '../shared/types/live';
import MultipleChoiceProjector from '../features/multiple-choice/components/MultipleChoiceProjector';
import PulseProjector from '../features/pulse/components/PulseProjector';
import WordCloudProjector from '../features/word-cloud/components/WordCloudProjector';
import { mergeParticipantWord } from '../features/word-cloud/model/utils';
import { WordCloudItem } from '../features/word-cloud/model/types';
export default function LiveResults({
  round,
  results,
}: {
  round: Round;
  results: PublicResponse[];
}) {
  const slide = round.slide;
  if (!round.visible)
    return (
      <div className="card live-results">
        <h2>{slide.title}</h2>
        <p>
          {round.phase === 'open' ? 'Приём ответов открыт' : 'Приём ответов закрыт'}. Результаты
          откроет ведущий.
        </p>
      </div>
    );
  if (!results.length)
    return (
      <div className="card live-results">
        <h2>{slide.title}</h2>
        <p>Опубликованных ответов пока нет.</p>
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
  return (
    <section className="live-results">
      <h2>{slide.title}</h2>
      <p>Опубликовано карточек: {results.length}</p>
      <div className="answer-grid">
        {[...results]
          .sort((a, b) => b.likes - a.likes || a.id.localeCompare(b.id))
          .map((r) => (
            <article className="card" key={r.id}>
              <p>{r.value}</p>
              {r.edited && <small>Отредактировано ведущим</small>}
              <p>Лайков: {r.likes}</p>
            </article>
          ))}
      </div>
    </section>
  );
}
