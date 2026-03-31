import Card from '../../../shared/ui/Card';
import Tabs from '../../../shared/ui/Tabs';
import { PulseProjectorView } from '../model/types';
import { PulseMetricDisplay, PulseVisualization } from '../../../shared/types/common';

type PulseAdminProps = {
  title: string;
  minLabel: string;
  maxLabel: string;
  participantValue: number;
  projectorView: PulseProjectorView;
  visualization: PulseVisualization;
  metricDisplay: PulseMetricDisplay;
  onTitleChange: (value: string) => void;
  onMinLabelChange: (value: string) => void;
  onMaxLabelChange: (value: string) => void;
  onParticipantValueChange: (value: number) => void;
  onProjectorViewChange: (value: PulseProjectorView) => void;
  onVisualizationChange: (value: PulseVisualization) => void;
  onMetricDisplayChange: (value: PulseMetricDisplay) => void;
};

export default function PulseAdmin({
  title,
  minLabel,
  maxLabel,
  participantValue,
  projectorView,
  visualization,
  metricDisplay,
  onTitleChange,
  onMinLabelChange,
  onMaxLabelChange,
  onParticipantValueChange,
  onProjectorViewChange,
  onVisualizationChange,
  onMetricDisplayChange,
}: PulseAdminProps) {
  return (
    <Card>
      <p className="muted">Модуль</p>
      <h3 style={{ marginTop: 0 }}>Пульс</h3>
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
          <span className="muted">Левая подпись</span>
          <input
            type="text"
            value={minLabel}
            onChange={(event) => onMinLabelChange(event.target.value)}
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
          <span className="muted">Правая подпись</span>
          <input
            type="text"
            value={maxLabel}
            onChange={(event) => onMaxLabelChange(event.target.value)}
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
          <span className="muted">Демо-значение участника: {participantValue}</span>
          <input
            type="range"
            min="1"
            max="10"
            value={participantValue}
            onChange={(event) => onParticipantValueChange(Number(event.target.value))}
          />
        </label>
        <div style={{ display: 'grid', gap: 8 }}>
          <span className="muted">Визуализация шкалы</span>
          <Tabs
            items={[
              { value: 'scale', label: 'Шкала' },
              { value: 'bars', label: 'Столбцы' },
              { value: 'line', label: 'Линия' },
            ]}
            value={visualization}
            onChange={onVisualizationChange}
          />
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          <span className="muted">Показывать метрики</span>
          <Tabs
            items={[
              { value: 'average', label: 'Среднее' },
              { value: 'participant', label: 'Ответ участника' },
              { value: 'both', label: 'Среднее и ответ' },
            ]}
            value={metricDisplay}
            onChange={onMetricDisplayChange}
          />
          <p className="muted" style={{ margin: 0 }}>
            Среднее показывает общий уровень по аудитории, ответ участника помогает проверить частный пример.
          </p>
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          <span className="muted">Режим экрана</span>
          <Tabs
            items={[
              { value: 'histogram', label: 'Распределение' },
              { value: 'summary', label: 'Карточки с числами' },
            ]}
            value={projectorView}
            onChange={onProjectorViewChange}
          />
          <p className="muted" style={{ margin: 0 }}>
            Распределение показывает все ответы по шкале, карточки выделяют только ключевые числа.
          </p>
        </div>
      </div>
    </Card>
  );
}
