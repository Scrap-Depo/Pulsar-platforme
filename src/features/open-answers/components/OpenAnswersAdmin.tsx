import Card from '../../../shared/ui/Card';
import Button from '../../../shared/ui/Button';
import GlassToggle from '../../../shared/ui/GlassToggle';
import Tabs from '../../../shared/ui/Tabs';
import { OpenAnswer } from '../model/types';
import { OpenAnswersVisualization } from '../../../shared/types/common';

type OpenAnswersAdminProps = {
  question: string;
  answers: OpenAnswer[];
  allowLikes: boolean;
  visualization: OpenAnswersVisualization;
  focusedAnswerId: string | null;
  editingAnswerId: string | null;
  draftAnswerText: string;
  onQuestionChange: (value: string) => void;
  onAllowLikesChange: (value: boolean) => void;
  onVisualizationChange: (value: OpenAnswersVisualization) => void;
  onFocusedAnswerChange: (id: string | null) => void;
  onStartEditing: (answer: OpenAnswer) => void;
  onDraftAnswerTextChange: (value: string) => void;
  onSaveEditing: (id: string) => void;
};

export default function OpenAnswersAdmin({
  question,
  answers,
  allowLikes,
  visualization,
  focusedAnswerId,
  editingAnswerId,
  draftAnswerText,
  onQuestionChange,
  onAllowLikesChange,
  onVisualizationChange,
  onFocusedAnswerChange,
  onStartEditing,
  onDraftAnswerTextChange,
  onSaveEditing,
}: OpenAnswersAdminProps) {
  return (
    <Card>
      <p className="muted">Модуль</p>
      <h3 style={{ marginTop: 0 }}>Открытые ответы</h3>
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

        <GlassToggle
          label="Разрешить лайки"
          active={allowLikes}
          onClick={() => onAllowLikesChange(!allowLikes)}
        />

        <div style={{ display: 'grid', gap: 8 }}>
          <span className="muted">Визуализация ответов</span>
          <Tabs
            items={[
              { value: 'cards', label: 'Карточки' },
              { value: 'bubbles', label: 'Пузыри' },
              { value: 'wall', label: 'Стена' },
            ]}
            value={visualization}
            onChange={onVisualizationChange}
          />
        </div>

        <div className="section-stack">
          {answers.map((answer) => {
            const isEditing = editingAnswerId === answer.id;
            const isFocused = focusedAnswerId === answer.id;

            return (
              <div key={answer.id} className="card" style={{ padding: 16 }}>
                <div className="section-stack">
                  {isEditing ? (
                    <textarea
                      rows={3}
                      value={draftAnswerText}
                      onChange={(event) => onDraftAnswerTextChange(event.target.value)}
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
                  ) : (
                    <p style={{ margin: 0 }}>"{answer.text}"</p>
                  )}
                  <div className="button-row">
                    <Button variant="ghost" onClick={() => onStartEditing(answer)}>
                      Редактировать
                    </Button>
                    {isEditing && (
                      <Button variant="secondary" onClick={() => onSaveEditing(answer.id)}>
                        Сохранить
                      </Button>
                    )}
                    <Button
                      variant={isFocused ? 'primary' : 'secondary'}
                      onClick={() => onFocusedAnswerChange(isFocused ? null : answer.id)}
                    >
                      {isFocused ? 'Убрать фокус' : 'В фокус'}
                    </Button>
                  </div>
                  <p className="muted" style={{ margin: 0 }}>
                    Лайков: {answer.likes}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
