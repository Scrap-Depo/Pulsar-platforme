import { CSSProperties } from 'react';
import { sortAnswersByLikes } from '../model/utils';
import Button from '../../../shared/ui/Button';
import { OpenAnswer } from '../model/types';
import { OpenAnswersVisualization } from '../../../shared/types/common';

type OpenAnswersProjectorProps = {
  question: string;
  answers: OpenAnswer[];
  focusedAnswerId: string | null;
  onFocusedAnswerChange: (id: string | null) => void;
  visualization?: OpenAnswersVisualization;
};

export default function OpenAnswersProjector({
  question,
  answers,
  focusedAnswerId,
  onFocusedAnswerChange,
  visualization = 'cards',
}: OpenAnswersProjectorProps) {
  const sortedAnswers = sortAnswersByLikes(answers);
  const focusedAnswer = focusedAnswerId
    ? sortedAnswers.find((answer) => answer.id === focusedAnswerId) ?? null
    : null;
  const layoutStyle: CSSProperties | undefined =
    visualization === 'wall'
      ? {
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 16,
        }
      : visualization === 'bubbles'
        ? {
            display: 'flex',
            flexWrap: 'wrap',
            gap: 18,
            justifyContent: 'center',
          }
        : undefined;

  return (
    <div style={{ width: '100%', maxWidth: 920 }}>
      <p className="muted" style={{ textAlign: 'center' }}>Проектор</p>
      <h1 className="hero-title" style={{ textAlign: 'center' }}>{question}</h1>

      {focusedAnswer && (
        <div className="card" style={{ padding: 28, marginBottom: 20, background: focusedAnswer.color }}>
          <div className="button-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <strong>Фокус</strong>
            <Button variant="ghost" onClick={() => onFocusedAnswerChange(null)}>
              Закрыть
            </Button>
          </div>
          <p style={{ fontSize: 32, lineHeight: 1.2 }}>"{focusedAnswer.text}"</p>
          <p className="muted" style={{ marginBottom: 0 }}>Лайков: {focusedAnswer.likes}</p>
        </div>
      )}

      <div className={visualization === 'cards' ? 'section-stack' : undefined} style={{ opacity: focusedAnswer ? 0.45 : 1, ...layoutStyle }}>
        {sortedAnswers.map((answer) => (
          <button
            key={answer.id}
            type="button"
            onClick={() => onFocusedAnswerChange(answer.id)}
            className="card"
            style={{
              padding: visualization === 'bubbles' ? 28 : 24,
              textAlign: 'left',
              background: answer.color,
              borderColor: focusedAnswerId === answer.id ? 'rgba(255,255,255,0.5)' : undefined,
              borderRadius: visualization === 'bubbles' ? 999 : undefined,
              minHeight: visualization === 'bubbles' ? 180 : undefined,
              display: 'grid',
              alignContent: 'center',
              width: visualization === 'bubbles' ? 'clamp(220px, 28vw, 300px)' : undefined,
            }}
          >
            <p style={{ fontSize: 24, marginTop: 0 }}>"{answer.text}"</p>
            <p className="muted" style={{ marginBottom: 0 }}>Лайков: {answer.likes}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
