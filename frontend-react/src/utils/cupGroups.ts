import type { StandingRow } from '../api/types';

const THEMES = [
  { color: 'primary', text: 'text-white' },
  { color: 'danger', text: 'text-white' },
  { color: 'success', text: 'text-white' },
  { color: 'info', text: 'text-white' },
  { color: 'secondary', text: 'text-white' },
  { color: 'dark', text: 'text-white' },
];

export function normalizeGrupo(grupo: string | null | undefined): string | null {
  if (grupo === null || grupo === undefined || grupo === '') return null;
  return String(grupo).trim();
}

export function themeForGrupo(grupo: string | null | undefined) {
  const g = normalizeGrupo(grupo) || 'A';
  const idx = Math.abs(g.charCodeAt(0) - 65) % THEMES.length;
  return THEMES[idx];
}

export function groupByGrupo<T>(items: T[], getGrupo: (item: T) => string | null | undefined) {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = normalizeGrupo(getGrupo(item)) ?? '_sem_grupo';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }

  return [...map.entries()]
    .sort(([a], [b]) => {
      if (a === '_sem_grupo') return 1;
      if (b === '_sem_grupo') return -1;
      return a.localeCompare(b);
    })
    .map(([grupo, rows]) => ({ grupo, rows }));
}

export function phaseLabel(phase: string): string {
  const labels: Record<string, string> = {
    groups: 'Grupos',
    r128: 'Round 128',
    r64: 'Round 64',
    r32: 'Round 32',
    r16: 'Oitavas',
    qf: 'Quartas',
    sf: 'Semifinal',
    '3p': '3º lugar',
    final: 'Final',
  };
  if (labels[phase]) return labels[phase];
  if (phase.startsWith('swiss_')) return `Suíço R${phase.replace('swiss_', '')}`;
  return phase;
}

export type GroupedStanding = { grupo: string; rows: StandingRow[] };
