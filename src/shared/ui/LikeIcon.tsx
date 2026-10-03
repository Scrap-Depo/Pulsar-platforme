import likeImage from '../assets/like.svg';

export default function LikeIcon({ size = 48 }: { size?: number }) {
  return (
    <img
      src={likeImage}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      className="like-icon"
    />
  );
}
