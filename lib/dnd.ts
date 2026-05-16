import { CollisionDetection, closestCenter } from '@dnd-kit/core';

export const closestCenterExcludingActive: CollisionDetection = (args) => {
  const collisions = closestCenter(args);
  if (!args.active) return collisions;
  return collisions.filter((c) => c.id !== args.active.id);
};
