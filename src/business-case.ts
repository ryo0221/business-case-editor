import { calculate } from './calculation';

export type DecimalValue = string | string[];
export interface Assumption {
  id: string; name: string; value: DecimalValue; unit: string; kind: string;
  source: { text: string; url?: string; projectId?: string }; description: string; dependsOn: string[];
}
export interface Scenario {
  id: string; type: string; assumptionIds: string[];
  overrides: { assumptionId: string; value: DecimalValue }[];
}
export interface Calculation {
  version: string; years: 10; currency: 'JPY'; revenueTHB: string; costJPY: string;
  initialInvestmentJPY: string; exchangeRate: string; taxRate: string; discountRate: string;
}
export interface BusinessCase {
  artifactKind: 'shinonome.business-case'; schemaVersion: 1;
  lastIssued: { FA: number; SC: number; AR: number };
  assumptions: Assumption[]; scenarios: Scenario[]; calculation: Calculation;
  acceptedResults: { id: string; scenario: Scenario; assumptions: Assumption[]; calculation: Calculation;
    metrics: { npvJPY: string; irrPercent: string; paybackYear: number | null } }[];
}

const fail = (): never => { throw new Error('収支データの形式と内容を確認してください。'); };
function object(value: unknown, keys: string[]): asserts value is Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype ||
      Reflect.ownKeys(value).length !== keys.length || keys.some(k => !Object.prototype.hasOwnProperty.call(value, k))) fail();
}
function text(value: unknown, max: number): asserts value is string {
  if (typeof value !== 'string' || !value.trim() || [...value].length > max) fail();
}
function id(value: unknown, prefix: string): asserts value is string {
  if (typeof value !== 'string' || !new RegExp(`^${prefix}-(?:0[1-9]|[1-9][0-9]{1,5})$`).test(value)) fail();
}
function decimal(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !/^-?(?:0|[1-9]\d{0,17})(?:\.\d{0,7}[1-9])?$/.test(value) || value === '-0') fail();
}
function decimalValue(value: unknown): asserts value is DecimalValue {
  if (Array.isArray(value)) { if (value.length !== 10) fail(); value.forEach(decimal); }
  else decimal(value);
}
function list(value: unknown, min: number, max: number): asserts value is any[] {
  if (!Array.isArray(value) || value.length < min || value.length > max) fail();
}
function references(value: unknown, min: number): asserts value is string[] {
  list(value, min, 200); value.forEach(v => id(v, 'FA'));
  if (new Set(value).size !== value.length) fail();
}
function assumption(value: unknown): asserts value is Assumption {
  object(value, ['id','name','value','unit','kind','source','description','dependsOn']);
  id(value.id, 'FA'); text(value.name, 100); text(value.description, 500); decimalValue(value.value);
  if (!['JPY','THB','unit','percent','year','JPY_per_THB'].includes(value.unit) ||
      !['actual','forecast','assumption','calculated'].includes(value.kind)) fail();
  const source = value.source;
  if (!source || typeof source !== 'object') fail();
  const isUrl = Object.prototype.hasOwnProperty.call(source, 'url');
  object(source, ['text', isUrl ? 'url' : 'projectId']); text(source.text, 500);
  if (isUrl) { text(source.url, 2048); if (!/^https?:\/\/[^\s/?#]+(?:[/?#][^\s]*)?$/.test(source.url)) fail(); }
  else { text(source.projectId, 32); id(source.projectId, 'MS'); }
  references(value.dependsOn, value.kind === 'calculated' ? 1 : 0);
  if (value.kind !== 'calculated' && value.dependsOn.length) fail();
}
function scenario(value: unknown): asserts value is Scenario {
  object(value, ['id','type','assumptionIds','overrides']); id(value.id, 'SC');
  if (!['base','optimistic','pessimistic'].includes(value.type)) fail();
  references(value.assumptionIds, 1); list(value.overrides, 0, 200);
  const used = new Set<string>();
  for (const override of value.overrides) {
    object(override, ['assumptionId','value']); id(override.assumptionId, 'FA'); decimalValue(override.value);
    if (used.has(override.assumptionId) || !value.assumptionIds.includes(override.assumptionId)) fail();
    used.add(override.assumptionId);
  }
}
const roles = ['revenueTHB','costJPY','initialInvestmentJPY','exchangeRate','taxRate','discountRate'] as const;
function calculation(value: unknown): asserts value is Calculation {
  object(value, ['version','years','currency',...roles]);
  if (!['1.0.0','2.0.0'].includes(value.version) || value.years !== 10 || value.currency !== 'JPY') fail();
  roles.forEach(role => id(value[role], 'FA'));
}
function checkGraph(assumptions: Assumption[], scenarios: Scenario[], calc: Calculation): void {
  const byId = new Map(assumptions.map(a => [a.id, a]));
  if (byId.size !== assumptions.length) fail();
  const visiting = new Set<string>(), visited = new Set<string>();
  function visit(key: string): void {
    if (visiting.has(key)) fail();
    if (visited.has(key)) return;
    const a = byId.get(key); if (!a) return fail();
    visiting.add(key); a.dependsOn.forEach(visit); visiting.delete(key); visited.add(key);
  }
  assumptions.forEach(a => visit(a.id));
  const units = ['THB','JPY','JPY','JPY_per_THB','percent','percent'];
  roles.forEach((role, index) => {
    const a = byId.get(calc[role]);
    if (!a || a.unit !== units[index] || (index > 1 && Array.isArray(a.value)) ||
        (calc.version === '1.0.0' && Array.isArray(a.value))) fail();
  });
  for (const s of scenarios) {
    const refs = new Set(s.assumptionIds);
    for (const key of refs) {
      const a = byId.get(key); if (!a || a.dependsOn.some(dep => !refs.has(dep))) fail();
    }
    if (roles.some(role => !refs.has(calc[role]))) fail();
    for (const o of s.overrides) {
      const a = byId.get(o.assumptionId);
      if (!a || Array.isArray(a.value) !== Array.isArray(o.value) ||
          (calc.version === '1.0.0' && roles.some(role => calc[role] === o.assumptionId) && Array.isArray(o.value))) fail();
    }
    const get = (role: typeof roles[number]): DecimalValue => {
      const key = calc[role]; return s.overrides.find(o => o.assumptionId === key)?.value ?? byId.get(key)!.value;
    };
    // calculate checks role ranges, but an absent IRR is valid for an unaccepted scenario.
    const nonnegative = (v: DecimalValue) => (Array.isArray(v) ? v : [v]).every(x => !x.startsWith('-'));
    if (!nonnegative(get('revenueTHB')) || !nonnegative(get('costJPY')) || !nonnegative(get('initialInvestmentJPY'))) fail();
    const exchange = get('exchangeRate') as string;
    if (exchange.startsWith('-') || exchange === '0') fail();
    for (const role of ['taxRate','discountRate'] as const) {
      const v = get(role) as string;
      if (v.startsWith('-') || BigInt(v.split('.')[0]) > 100n || (v.split('.')[0] === '100' && v.includes('.'))) fail();
    }
  }
}
function utf8Size(value: string): number {
  let size = 0;
  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) {
      const next = value.charCodeAt(++i); if (!(next >= 0xdc00 && next <= 0xdfff)) fail(); size += 4;
    } else if (c >= 0xdc00 && c <= 0xdfff) fail();
    else size += c < 0x80 ? 1 : c < 0x800 ? 2 : 3;
  }
  return size;
}
/** Validate the complete native document without relying on browser or host APIs. */
export function validateBusinessCase(value: unknown): asserts value is BusinessCase {
  // Inspect raw strings before JSON serialization, which escapes invalid surrogates.
  const inspect = (v: unknown, seen: Set<object>): void => {
    if (typeof v === 'string') { utf8Size(v); return; }
    if (!v || typeof v !== 'object') return;
    if (seen.has(v)) fail(); seen.add(v);
    for (const key of Object.keys(v)) { utf8Size(key); inspect((v as Record<string, unknown>)[key], seen); }
    seen.delete(v);
  };
  inspect(value, new Set());
  const serialized = JSON.stringify(value); if (!serialized || utf8Size(serialized) > 1048576) fail();
  object(value, ['artifactKind','schemaVersion','lastIssued','assumptions','scenarios','calculation','acceptedResults']);
  if (value.artifactKind !== 'shinonome.business-case' || value.schemaVersion !== 1) fail();
  object(value.lastIssued, ['FA','SC','AR']);
  for (const n of Object.values(value.lastIssued)) if (!Number.isInteger(n) || (n as number) < 0 || (n as number) > 999999) fail();
  list(value.assumptions, 1, 200); value.assumptions.forEach(assumption);
  list(value.scenarios, 3, 3); value.scenarios.forEach(scenario);
  if (new Set(value.scenarios.map((s: Scenario) => s.type)).size !== 3) fail();
  calculation(value.calculation); checkGraph(value.assumptions, value.scenarios, value.calculation);
  list(value.acceptedResults, 0, 20);
  for (const result of value.acceptedResults) {
    object(result, ['id','scenario','assumptions','calculation','metrics']); id(result.id, 'AR'); scenario(result.scenario);
    list(result.assumptions, 1, 200); result.assumptions.forEach(assumption); calculation(result.calculation);
    checkGraph(result.assumptions, [result.scenario], result.calculation);
    object(result.metrics, ['npvJPY','irrPercent','paybackYear']); decimal(result.metrics.npvJPY); decimal(result.metrics.irrPercent);
    if (result.metrics.paybackYear !== null && (!Number.isInteger(result.metrics.paybackYear) || result.metrics.paybackYear < 1 || result.metrics.paybackYear > 10)) fail();
    const get = (role: typeof roles[number]) => {
      const key = result.calculation[role];
      return result.scenario.overrides.find((o: Scenario['overrides'][number]) => o.assumptionId === key)?.value ?? result.assumptions.find((a: Assumption) => a.id === key)!.value;
    };
    const computed = calculate({ version: result.calculation.version, revenueTHB: get('revenueTHB'), costJPY: get('costJPY'), initialInvestmentJPY: get('initialInvestmentJPY') as string, exchangeRate: get('exchangeRate') as string, taxRate: get('taxRate') as string, discountRate: get('discountRate') as string });
    if (computed.npvJPY !== result.metrics.npvJPY || computed.irrPercent !== result.metrics.irrPercent || computed.paybackYear !== result.metrics.paybackYear) fail();
  }
  for (const [prefix, items] of [['FA',value.assumptions],['SC',value.scenarios],['AR',value.acceptedResults]] as const) {
    const ids = items.map((item: {id: string}) => item.id);
    if (new Set(ids).size !== ids.length || ids.some((v: string) => Number(v.slice(3)) > value.lastIssued[prefix])) fail();
  }
}
