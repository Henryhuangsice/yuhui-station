import type { Gesture, Look, Pose } from '../game/character';

export type Anim = 'idle' | 'walk' | 'air';

export interface PeerState {
  id: string;
  name: string;
  job: string;
  look: Look;
  d: [number, number, number];
  f: [number, number, number];
  h: number;
  sp: number;
  anim: Anim;
  pose: Pose;
  gesture: Gesture;
  scale: number;
  aura: string | null;
  t: number;
}

type Msg =
  | { t: 'state'; s: PeerState }
  | { t: 'emoji'; id: string; e: string }
  | { t: 'bye'; id: string };

export const MAX_WORLD = 10;

/**
 * Same-device presence over BroadcastChannel: every open tab is a player.
 * The interface matches what a hosted realtime channel would provide later.
 */
export class Presence {
  readonly id = Math.random().toString(36).slice(2, 10);
  readonly peers = new Map<string, PeerState>();
  onEmoji: ((id: string, e: string) => void) | null = null;
  onLeave: ((id: string) => void) | null = null;
  private ch: BroadcastChannel | null = 'BroadcastChannel' in window ? new BroadcastChannel('yuhui-station') : null;

  constructor() {
    if (!this.ch) return;
    this.ch.onmessage = (ev: MessageEvent<Msg>) => {
      const m = ev.data;
      if (m.t === 'state') {
        if (m.s.id === this.id) return;
        if (!this.peers.has(m.s.id) && this.peers.size >= MAX_WORLD - 1) return;
        const s = m.s;
        this.peers.set(s.id, { ...s, pose: s.pose ?? 'stand', gesture: s.gesture ?? 'none', scale: s.scale ?? 1, aura: s.aura ?? null, t: performance.now() });
      } else if (m.t === 'emoji') {
        this.onEmoji?.(m.id, m.e);
      } else if (m.t === 'bye') {
        this.peers.delete(m.id);
        this.onLeave?.(m.id);
      }
    };
    window.addEventListener('pagehide', () => this.ch?.postMessage({ t: 'bye', id: this.id } satisfies Msg));
  }

  send(s: Omit<PeerState, 'id' | 't'>) {
    this.ch?.postMessage({ t: 'state', s: { ...s, id: this.id, t: 0 } } satisfies Msg);
  }

  emoji(e: string) {
    this.ch?.postMessage({ t: 'emoji', id: this.id, e } satisfies Msg);
  }

  prune() {
    const now = performance.now();
    for (const [id, p] of this.peers) {
      if (now - p.t > 3000) {
        this.peers.delete(id);
        this.onLeave?.(id);
      }
    }
  }
}
