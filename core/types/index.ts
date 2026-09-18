/**
 * Core type barrel — re-exports all domain vocabulary.
 *
 * Gate 1: IDs + objects
 * Gate 2: Lifecycle state machines
 * Gate 3: Command + Event algebras
 */
export * from './00_ids';
export * from './01_objects';
export * from './02_lifecycle';
export * from './03_commands';
export * from './04_events';
export * from './05_policy';
export * from './06_engine';
export * from '../03_sovereign_identity';
