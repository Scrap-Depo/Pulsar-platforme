import Card from '../../../shared/ui/Card';
import Button from '../../../shared/ui/Button';
import Tabs from '../../../shared/ui/Tabs';
import { MultipleChoiceOption } from '../model/types';
import { MultipleChoiceResultDisplay, MultipleChoiceVisualization } from '../../../shared/types/common';

type MultipleChoiceAdminProps = {
  question: string;
  options: MultipleChoiceOption[];
  visualization: MultipleChoiceVisualization;
  resultDisplay: MultipleChoiceResultDisplay;
  onQuestionChange: (value: string) => void;
  onOptionsChange: (options: MultipleChoiceOption[]) => void;
  onVisualizationChange: (value: MultipleChoiceVisualization) => void;
  onResultDisplayChange: (value: MultipleChoiceResultDisplay) => void;
};

const optionColors = [
  'linear-gradient(135deg, #479ddb, #3363c1)',
  'linear-gradient(135deg, #b7bfe0, #6f72c4)',
  'linear-gradient(135deg, #c03654, #7f1d1d)',
  'linear-gradient(135deg, #31417b, #0a0a21)',
];

export default function MultipleChoiceAdmin({
  question,
  options,
  visualization,
  resultDisplay,
  onQuestionChange,
  onOptionsChange,
  onVisualizationChange,
  onResultDisplayChange,
}: MultipleChoiceAdminProps) {
  function updateOptionText(id: number, text: string) {
    onOptionsChange(options.map((option) => (option.id === id ? { ...option, text } : option)));
  }

  function addOption() {
    if (options.length >= 8) {
      return;
    }

    onOptionsChange([
      ...options,
      {
        id: Date.now(),
        text: `Новый вариант ${options.length + 1}`,
        votes: 0,
        color: optionColors[options.length % optionColors.length],
      },
    ]);
  }

  function removeOption(id: number) {
    if (options.length <= 2) {
      return;
    }

    onOptionsChange(options.filter((option) => option.id !== id));
  }

  return (
    <Card>
      <p className="muted">Модуль</p>
      <h3 style={{ marginTop: 0 }}>Голосование</h3>
      <div className="section-stack">
        <label style={{ display: 'grid', gap: 8 }}>
          <span className="muted">Вопрос аудитории</span>
          <textarea
            rows={3}
            value={question}
            onChange={(event) => onQuestionChange(event.target.value)}
            style={{
              width: '100%',
              borderRadius: 16,
              padding: 14,
              border: '1px solid rgba(148, 163, 184, 0.18)',
              background: 'rgba(2, 6, 23, 0.45)',
              color: '#e2e8f0',
              resize: 'vertical',
            }}
          />
        </label>

        <div style={{ display: 'grid', gap: 8 }}>
          <span className="muted">Визуализация результата</span>
          <Tabs
            items={[
              { value: 'bar', label: 'Столбцы' },
              { value: 'pie', label: 'Круг' },
              { value: 'donut', label: 'Кольцо' },
            ]}
            value={visualization}
            onChange={onVisualizationChange}
          />
        </div>

        <div style={{ display: 'grid', gap: 8 }}>
          <span className="muted">Показывать на проекторе</span>
          <Tabs
            items={[
              { value: 'percent', label: 'Проценты' },
              { value: 'votes', label: 'Голоса' },
              { value: 'both', label: 'Проценты и голоса' },
            ]}
            value={resultDisplay}
            onChange={onResultDisplayChange}
          />
          <p className="muted" style={{ margin: 0 }}>
            Можно показывать только доли, только число голосов или оба значения сразу.
          </p>
        </div>

        <div className="section-stack">
          {options.map((option, index) => (
            <div key={option.id} className="card" style={{ padding: 14 }}>
              <div style={{ display: 'grid', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      width: 14,
                      alignSelf: 'stretch',
                      borderRadius: 999,
                      background: option.color,
                    }}
                  />
                  <input
                    type="text"
                    value={option.text}
                    onChange={(event) => updateOptionText(option.id, event.target.value)}
                    style={{
                      flex: 1,
                      borderRadius: 14,
                      padding: 12,
                      border: '1px solid rgba(148, 163, 184, 0.18)',
                      background: 'rgba(2, 6, 23, 0.35)',
                      color: '#e2e8f0',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="muted">Вариант {index + 1}</span>
                  <Button variant="ghost" onClick={() => removeOption(option.id)}>
                    Удалить
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <Button variant="secondary" onClick={addOption}>
          Добавить вариант
        </Button>
      </div>
    </Card>
  );
}
