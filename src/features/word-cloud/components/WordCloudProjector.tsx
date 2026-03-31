import { CSSProperties } from 'react';
import { sortWordsByCount } from '../model/utils';
import { WordCloudItem } from '../model/types';
import { WordCloudVisualization } from '../../../shared/types/common';

type WordCloudProjectorProps = {
  title: string;
  words: WordCloudItem[];
  participantWord: string;
  visualization?: WordCloudVisualization;
};

export default function WordCloudProjector({
  title,
  words,
  participantWord,
  visualization = 'cloud',
}: WordCloudProjectorProps) {
  const sortedWords = sortWordsByCount(words);
  const containerStyle: CSSProperties =
    visualization === 'bubbles'
      ? {
          display: 'flex',
          flexWrap: 'wrap',
          gap: 18,
          justifyContent: 'center',
          alignItems: 'center',
        }
      : visualization === 'constellation'
        ? {
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 16,
          }
        : {
            display: 'flex',
            flexWrap: 'wrap',
            gap: 16,
            justifyContent: 'center',
          };

  return (
    <div style={{ width: '100%', maxWidth: 920, textAlign: 'center' }}>
      <p className="muted">Проектор</p>
      <h1 className="hero-title">{title}</h1>
      <p className="hero-text" style={{ margin: '0 auto 24px' }}>
        {participantWord.trim() ? `Новое слово: ${participantWord.trim()}` : 'Добавьте слово с экрана участника'}
      </p>
      <div
        className="card"
        style={{
          padding: 32,
          ...containerStyle,
        }}
      >
        {sortedWords.map((word) => (
          <span
            key={word.text}
            style={{
              fontSize: visualization === 'constellation' ? `${16 + word.count * 0.8}px` : `${18 + word.count * 1.4}px`,
              fontWeight: 700,
              color: word.color,
              padding: visualization === 'bubbles' ? '18px 22px' : visualization === 'constellation' ? '18px' : undefined,
              borderRadius: visualization === 'bubbles' ? 999 : 16,
              background:
                visualization === 'bubbles'
                  ? 'radial-gradient(circle at 35% 35%, rgba(255,255,255,0.24), rgba(56,189,248,0.14) 55%, rgba(37,99,235,0.14))'
                  : visualization === 'constellation'
                    ? 'rgba(15, 23, 42, 0.55)'
                    : undefined,
              border: visualization === 'cloud' ? undefined : '1px solid rgba(148, 163, 184, 0.16)',
            }}
          >
            {word.text}
          </span>
        ))}
      </div>
    </div>
  );
}
