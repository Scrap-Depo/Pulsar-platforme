import { useState } from 'react';

export type Particle = {
  id: number;
  left: number;
};

export function useParticles() {
  const [particles, setParticles] = useState<Particle[]>([]);

  function spawnParticle() {
    const particle = { id: Date.now(), left: Math.round(Math.random() * 80) + 10 };
    setParticles((current) => [...current, particle]);
  }

  return {
    particles,
    spawnParticle,
    setParticles,
  };
}
