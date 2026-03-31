import Card from '../../../shared/ui/Card';
import { WordCloudItem } from '../model/types';

type WordCloudParticipantProps = {
  title: string;
  participantWord: string;
  useAI: boolean;
  words: WordCloudItem[];
  onParticipantWordChange: (value: string) => void;
};

export default function WordCloudParticipant({
  title,
  participantWord,
  useAI,
  words,
  onParticipantWordChange,
}: WordCloudParticipantProps) {
  return (
    <Card>
      <p className="muted">Участник</p>
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      <div className="section-stack">
        <input
          type="text"
          value={participantWord}
          onChange={(event) => onParticipantWordChange(event.target.value)}
          placeholder="Например: вдохновение"
          style={{
            borderRadius: 14,
            padding: 12,
            border: '1px solid rgba(148, 163, 184, 0.18)',
            background: 'rgba(2, 6, 23, 0.35)',
            color: '#e2e8f0',
          }}
        />
        <p className="hero-text">
          Нормализация слов сейчас {useAI ? 'включена' : 'выключена'}. Новое слово сразу влияет на облако.
        </p>
        <p className="muted" style={{ marginBottom: 0 }}>
          Активных слов в облаке: {words.length}
        </p>
      </div>
    </Card>
  );
}
