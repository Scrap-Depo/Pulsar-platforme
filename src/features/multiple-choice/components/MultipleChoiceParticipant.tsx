import Card from '../../../shared/ui/Card';
import Button from '../../../shared/ui/Button';
import { MultipleChoiceOption } from '../model/types';

type MultipleChoiceParticipantProps = {
  question: string;
  options: MultipleChoiceOption[];
  participantVote: number | null;
  hasVoted: boolean;
  onVoteChange: (value: number) => void;
  onReset: () => void;
  onSubmit: () => void;
};

export default function MultipleChoiceParticipant({
  question,
  options,
  participantVote,
  hasVoted,
  onVoteChange,
  onReset,
  onSubmit,
}: MultipleChoiceParticipantProps) {
  return (
    <Card>
      <p className="muted">Участник</p>
      <h2 style={{ marginTop: 0 }}>{question}</h2>
      {hasVoted ? (
        <div className="section-stack">
          <p className="hero-text">Голос принят. Можно сбросить выбор и попробовать сценарий заново.</p>
          <div className="button-row">
            <Button onClick={onReset}>Сбросить демо-голос</Button>
          </div>
        </div>
      ) : (
        <div className="section-stack">
          {options.map((option) => {
            const isActive = participantVote === option.id;

            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onVoteChange(option.id)}
                className="card"
                style={{
                  padding: 16,
                  textAlign: 'left',
                  borderColor: isActive ? 'rgba(56, 189, 248, 0.7)' : undefined,
                  boxShadow: isActive ? '0 0 0 1px rgba(56, 189, 248, 0.35)' : undefined,
                }}
              >
                {option.text}
              </button>
            );
          })}
          <div className="button-row">
            <Button onClick={onSubmit} disabled={!participantVote}>
              Голосовать
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
