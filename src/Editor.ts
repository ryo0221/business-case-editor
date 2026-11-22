import type { ScopedHost } from '@editor-platform/extension-contract';
import type { BusinessCase, DecimalValue } from './business-case';
import { calculate } from './calculation';
import styles from './styles.css?inline';
function el<K extends keyof HTMLElementTagNameMap>(tag: K, value?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag); if (value !== undefined) node.textContent = value; return node;
}
function table(headers: string[], rows: string[][]): HTMLTableElement {
  const t = el('table'); const head = el('thead'); const tr = el('tr');
  for (const value of headers) { const cell = el('th', value); cell.scope = 'col'; tr.append(cell); }
  head.append(tr); t.append(head); const body = el('tbody');
  for (const row of rows) { const r = el('tr'); for (const value of row) r.append(el('td', value)); body.append(r); } t.append(body); return t;
}
export function mountEditor(container: HTMLElement, host: ScopedHost<BusinessCase>): () => void {
  const root = el('section'); root.className = 'business-editor'; root.setAttribute('aria-label', '収支の比較');
  const style = el('style', styles); const content = el('div'); root.append(style, content); container.append(root); let rendered = '';
  function render(doc: BusinessCase) {
    rendered = JSON.stringify(doc); content.replaceChildren();
    content.append(el('h2', '前提'));
    const assumptions = el('div'); assumptions.className = 'business-table';
    assumptions.append(table(['ID', '名前', '値（年次は年1〜10）', '単位', '種類', '出所'], doc.assumptions.map(a => [a.id, a.name, Array.isArray(a.value) ? a.value.join(' / ') : a.value, a.unit, a.kind, `${a.source.text} (${a.source.url ?? a.source.projectId})`]))); content.append(assumptions);
    content.append(el('h2', 'シナリオ比較')); const rows: string[][] = [];
    for (const scenario of doc.scenarios) {
      const label = ({base:'基本', optimistic:'楽観', pessimistic:'悲観'} as Record<string,string>)[scenario.type] ?? scenario.type;
      try {
        const get = (role: 'revenueTHB'|'costJPY'|'initialInvestmentJPY'|'exchangeRate'|'taxRate'|'discountRate'): DecimalValue => { const id = doc.calculation[role]; return scenario.overrides.find(o => o.assumptionId === id)?.value ?? doc.assumptions.find(a => a.id === id)!.value; };
        const result = calculate({version: doc.calculation.version, revenueTHB: get('revenueTHB'), costJPY: get('costJPY'), initialInvestmentJPY: get('initialInvestmentJPY') as string, exchangeRate: get('exchangeRate') as string, taxRate: get('taxRate') as string, discountRate: get('discountRate') as string});
        rows.push([label, result.npvJPY, `${result.irrPercent}%`, result.paybackYear === null ? '10年以内に回収なし' : `${result.paybackYear}年`]);
      } catch (error) { rows.push([label, `計算できません: ${error instanceof Error ? error.message : '条件を確認してください。'}`, '計算できません', '計算できません']); }
    }
    const comparison = el('div'); comparison.className = 'business-table'; comparison.append(table(['シナリオ', 'NPV（円）', 'IRR', '回収年'], rows)); content.append(comparison);
  }
  render(host.read()); const timer = setInterval(() => { const current = host.read(); if (JSON.stringify(current) !== rendered) render(current); }, 200);
  return () => { clearInterval(timer); root.remove(); };
}
