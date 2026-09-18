import type { EngineAdapter, EngineAdapterFactory } from './types/06_engine';
import { FakeEngineAdapter } from './FakeEngineAdapter';
import { RealEngineAdapter } from './RealEngineAdapter';

export async function createRealEngineAdapter(): Promise<EngineAdapter> {
  return new RealEngineAdapter();
}

export async function createRuntimeEngineAdapter(): Promise<EngineAdapter> {
  if (typeof window !== 'undefined' || typeof document !== 'undefined') {
    return new RealEngineAdapter();
  }
  return new FakeEngineAdapter();
}

export const defaultEngineFactory: EngineAdapterFactory = async () =>
  createRuntimeEngineAdapter();
