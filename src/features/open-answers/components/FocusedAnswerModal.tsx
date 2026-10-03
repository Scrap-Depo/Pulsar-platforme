import LikeCount from '../../../shared/ui/LikeCount';
import Modal from '../../../shared/ui/Modal';

type FocusedAnswerModalProps = {
  text: string;
  likes: number;
};

export default function FocusedAnswerModal({ text, likes }: FocusedAnswerModalProps) {
  return (
    <Modal>
      <p className="muted">Фокус ответа</p>
      <h2 style={{ marginTop: 0 }}>"{text}"</h2>
      <LikeCount count={likes} />
    </Modal>
  );
}
