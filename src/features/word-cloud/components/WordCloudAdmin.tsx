import Card from '../../../shared/ui/Card';
import GlassToggle from '../../../shared/ui/GlassToggle';
import Tabs from '../../../shared/ui/Tabs';
import { WordCloudVisualization } from '../../../shared/types/common';

type WordCloudAdminProps = {
  title: string;
  participantWord: string;
  useAI: boolean;
  visualization: WordCloudVisualization;
  onTitleChange: (value: string) => void;
  onParticipantWordChange: (value: string) => void;
  onUseAIChange: (value: boolean) => void;
  onVisualizationChange: (value: WordCloudVisualization) => void;
};

export default function WordCloudAdmin({
  title,
  participantWord,
  useAI,
  visualization,
  onTitleChange,
  onParticipantWordChange,
  onUseAIChange,
  onVisualizationChange,
}: WordCloudAdminProps) {
  return (
    <Card>
      <p className="muted">Модуль</p>
      <h3 style={{ marginTop: 0 }}>Облако слов</h3>
      <div className="section-stack">
        <label style={{ display: 'grid', gap: 8 }}>
          <span className="muted">Заголовок слайда</span>
          <input
            type="text"
            value={title}
            onChange={(event) => onTitleChange(event.target.value)}
            style={{
              borderRadius: 14,
              padding: 12,
              border: '1px solid rgba(148, 163, 184, 0.18)',
              background: 'rgba(2, 6, 23, 0.35)',
              color: '#e2e8f0',
            }}
          />
        </label>
        <label style={{ display: 'grid', gap: 8 }}>
          <span className="muted">Демо-слово участника</span>
          <input
            type="text"
            value={participantWord}
            onChange={(event) => onParticipantWordChange(event.target.value)}
            style={{
              borderRadius: 14,
              padding: 12,
              border: '1px solid rgba(148, 163, 184, 0.18)',
              background: 'rgba(2, 6, 23, 0.35)',
              color: '#e2e8f0',
            }}
          />
        </label>
        <GlassToggle
          label="Нормализация слов"
          active={useAI}
          onClick={() => onUseAIChange(!useAI)}
        />
        <div style={{ display: 'grid', gap: 8 }}>
          <span className="muted">Визуализация облака</span>
          <Tabs
            items={[
              { value: 'cloud', label: 'Облако' },
              { value: 'bubbles', label: 'Пузыри' },
              { value: 'constellation', label: 'Созвездие' },
            ]}
            value={visualization}
            onChange={onVisualizationChange}
          />
        </div>
      </div>
    </Card>
  );
}
