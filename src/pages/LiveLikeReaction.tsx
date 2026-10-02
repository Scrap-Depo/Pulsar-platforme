import { useEffect, useRef, useState } from 'react';
import { ThumbsUp } from 'lucide-react';
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
    if (added)
      setBursts((current) =>
        [
          ...current,
          ...Array.from({ length: Math.min(added, 6) }, () => ({
            id: crypto.randomUUID(),
            roundId,
            x: 35 + Math.random() * 30,
          })),
        ].slice(-12),
      );
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
            style={{ left: `${burst.x}%` }}
            onAnimationEnd={() =>
              setBursts((current) => current.filter((item) => item.id !== burst.id))
            }
          >
            <ThumbsUp size={48} />
          </span>
        ))}
    </>
  );
}
