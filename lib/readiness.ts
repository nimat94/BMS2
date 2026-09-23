import type { Readiness } from './types';
import { READINESS_MARKERS } from './types';

export function readinessKey(kind: string, section: string, front: string) {
  return `${kind}|${section}|${front}`;
}

export function emptyReadiness(kind: 'cable' | 'equipment', section: string, front: string): Readiness {
  return { kind, section, front, stroy: 'Нет', smezh: 'Нет', materials: 'Нет', permit: 'Нет', docs: 'Нет', secured: 'Нет', note: '' };
}

export function missingMarkers(r: Readiness | undefined): string[] {
  if (!r) return READINESS_MARKERS.map(m => m.label);
  return READINESS_MARKERS.filter(m => r[m.key] !== 'Да').map(m => m.label);
}

export function isReady(r: Readiness | undefined): boolean {
  return missingMarkers(r).length === 0;
}

export function readyCount(r: Readiness | undefined): number {
  return READINESS_MARKERS.length - missingMarkers(r).length;
}
