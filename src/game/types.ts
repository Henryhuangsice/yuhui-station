import type * as THREE from 'three';

export interface Seat {
  id: string;
  dir: THREE.Vector3;
  fwd: THREE.Vector3;
  h: number;
  occupiedBy: string | null;
  label?: string;
}

export type SiteId = 'temple' | 'church' | 'dao';

export type SpotKind = 'bow' | 'muyu' | 'fortune' | 'incense' | 'bell' | 'candle' | 'pray' | 'meditate' | 'alchemy';

export interface Spot {
  id: string;
  kind: SpotKind;
  site: SiteId;
  label: string;
  dir: THREE.Vector3;
  fwd: THREE.Vector3;
  h: number;
  /** World point the action is about (wooden fish, bell, furnace). */
  focus: THREE.Vector3;
}
