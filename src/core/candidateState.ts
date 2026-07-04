export type CandidateId = string;

export function removeCandidateById<T extends { id: CandidateId }>(items: T[], id: CandidateId): T[] {
  return items.filter((item) => item.id !== id);
}

export function findCandidateById<T extends { id: CandidateId }>(items: T[], id: CandidateId | null): T | null {
  if (!id) return null;
  return items.find((item) => item.id === id) ?? null;
}

export function replaceCandidates<T>(current: T[], next: T[]): T[] {
  return next.length ? next : current;
}
