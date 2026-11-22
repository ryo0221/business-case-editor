import { validateBusinessCase, type BusinessCase } from './business-case';
export { validateBusinessCase } from './business-case';
export type { BusinessCase } from './business-case';
export const ARTIFACT_KIND = 'shinonome.business-case' as const;
export const SCHEMA_VERSION = 1 as const;
export function isBusinessCase(value: unknown): value is BusinessCase {
  try { validateBusinessCase(value); return true; } catch { return false; }
}
