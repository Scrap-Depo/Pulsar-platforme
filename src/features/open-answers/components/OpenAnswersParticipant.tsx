import Card from '../../../shared/ui/Card';
import Button from '../../../shared/ui/Button';
import { OpenAnswer } from '../model/types';

type OpenAnswersParticipantProps = {
  question: string;
  answers: OpenAnswer[];
  participantPhrase: string;
  stickersUsed: number;
  allowLikes: boolean;
  likedIds: string[];
  onPhraseChange: (value: string) => void;
  onSubmit: () => void;
  onToggleLike: (id: string) => void;
};

export default function OpenAnswersParticipant({
  question,
  answers,
  participantPhrase,
  stickersUsed,
  allowLikes,
  likedIds,
  onPhraseChange,
  onSubmit,
  onToggleLike,
}: OpenAnswersParticipantProps) {
  return (
    <Card>
      <h2 style={{ marginTop: 0 }}>{question}</h2>
      <div className="section-stack">
        <textarea
          rows={3}
          value={participantPhrase}
          onChange={(event) => onPhraseChange(event.target.value)}
          placeholder="Напишите короткий ответ"
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
        <div className="button-row">
          <Button onClick={onSubmit} disabled={!participantPhrase.trim() || stickersUsed >= 3}>
            Отправить
          </Button>
          <span className="muted" style={{ alignSelf: 'center' }}>
            Использовано карточек: {stickersUsed}/3
          </span>
        </div>
        <div className="section-stack">
          {answers.map((answer) => {
            const isLiked = likedIds.includes(answer.id);

            return (
              <div key={answer.id} className="card" style={{ padding: 16 }}>
                <p style={{ marginTop: 0 }}>"{answer.text}"</p>
                <div className="button-row">
                  <Button
                    variant={isLiked ? 'primary' : 'secondary'}
                    onClick={() => onToggleLike(answer.id)}
                    disabled={!allowLikes}
                  >
                    {isLiked ? `Убрать лайк (${answer.likes})` : `Лайк (${answer.likes})`}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
