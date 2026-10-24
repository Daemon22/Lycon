/**
 * Lycon boundary contract.
 *
 * This types Lycon's fundamental boundary question: "What is allowed to cross
 * this boundary, from which world, to which world, under whose authority, and
 * with what context?"
 *
 * Enforcement wiring comes later; this file carries the governing types only.
 */

export type World = 'global' | 'persona' | 'local';

export interface BoundaryCrossing {
  readonly crossingId: string;
  readonly from: World;
  readonly to: World;
  readonly authority: string;
  readonly context: string;
  readonly kind: string;
}

export type Decision =
  | { readonly type: 'allow' }
  | { readonly type: 'deny'; readonly reason: string }
  | { readonly type: 'require-consent'; readonly reason?: string };

export interface BoundaryPolicy {
  evaluate(crossing: BoundaryCrossing): Decision;
}
