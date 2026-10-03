import { useEffect, useRef, useState } from 'react';
import LikeIcon from '../shared/ui/LikeIcon';
import { PublicResponse } from '../shared/types/live';

export default function LiveLikeReaction({
  roundId,
  results,
  loaded,
}: {
  roundId: string;
  results: PublicResponse[];
  loaded: boolean;
}) {
  const nextStart = useRef(0);
  const previous = useRef<{ roundId: string; counts: Map<string, number> } | null>(null);
  const [bursts, setBursts] = useState<Array<{ id: string; roundId: string; x: number }>>([]);
  useEffect(() => {
    if (!loaded) return;
    const counts = new Map(results.map((r) => [r.id, r.likes]));
    const before = previous.current;
    previous.current = { roundId, counts };
    // Initial results and reopening the projector establish a baseline, without replay.
    if (!before || before.roundId !== roundId) return;
    const added = results.reduce(
      (sum, r) =>
        sum + (before.counts.has(r.id) ? Math.max(0, r.likes - before.counts.get(r.id)!) : 0),
      0,
    );
    if (added) {
      const incoming = Array.from({ length: Math.min(added, 6) }, () => ({
        id: crypto.randomUUID(),
        roundId,
        x: 20 + ((nextStart.current++ * 17) % 60),
      }));
      setBursts((current) => [...current, ...incoming].slice(-12));
    }
  }, [roundId, results, loaded]);
  return (
    <>
      {bursts
        .filter((burst) => burst.roundId === roundId)
        .map((burst) => (
          <span
            key={burst.id}
            className="like-burst"
            aria-hidden="true"
            style={{
              left: `clamp(calc(var(--like-amplitude) + 104px), ${burst.x}vw, calc(100vw - var(--like-amplitude) - 104px))`,
            }}
            onAnimationEnd={() =>
              setBursts((current) => current.filter((item) => item.id !== burst.id))
            }
          >
            <LikeIcon size={192} />
          </span>
        ))}
    </>
  );
}
