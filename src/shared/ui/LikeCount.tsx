import LikeIcon from './LikeIcon';

export default function LikeCount({ count, label }: { count: number; label?: string }) {
  return (
    <span className="like-count" aria-label={label ?? `Количество лайков: ${count}`}>
      <LikeIcon size={48} />
      <span>{count}</span>
    </span>
  );
}
