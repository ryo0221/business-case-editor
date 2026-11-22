/** Exact rational arithmetic for the published cash-flow rules. */
type Rational = { n: bigint; d: bigint };
const rat = (n: bigint, d = 1n): Rational => {
  if (d === 0n) throw new Error('ゼロで割ることはできません。');
  if (d < 0n) { n = -n; d = -d; }
  let a = n < 0n ? -n : n, b = d;
  while (b) [a, b] = [b, a % b];
  return { n: n / a, d: d / a };
};
const add = (a: Rational, b: Rational) => rat(a.n * b.d + b.n * a.d, a.d * b.d);
const neg = (a: Rational) => rat(-a.n, a.d);
const sub = (a: Rational, b: Rational) => add(a, neg(b));
const mul = (a: Rational, b: Rational) => rat(a.n * b.n, a.d * b.d);
const div = (a: Rational, b: Rational) => rat(a.n * b.d, a.d * b.n);
const zero = rat(0n), one = rat(1n), hundred = rat(100n);
function decimal(value: string): Rational {
  if (!/^-?(?:0|[1-9]\d*)(?:\.\d*[1-9])?$/.test(value) || value === '-0') throw new Error('十進数の形式を確認してください。');
  const negative = value.startsWith('-');
  const [whole, fraction = ''] = (negative ? value.slice(1) : value).split('.');
  return rat((negative ? -1n : 1n) * BigInt(whole + fraction), 10n ** BigInt(fraction.length));
}
function rounded(value: Rational, places: number): string {
  const scale = 10n ** BigInt(places), sign = value.n < 0n ? -1n : 1n;
  const abs = value.n < 0n ? -value.n : value.n;
  const integer = (abs * scale * 2n + value.d) / (2n * value.d) * sign;
  const negative = integer < 0n, digits = (negative ? -integer : integer).toString().padStart(places + 1, '0');
  if (!places) return (negative ? '-' : '') + digits;
  const fraction = digits.slice(-places).replace(/0+$/, '');
  return (negative ? '-' : '') + digits.slice(0, -places) + (fraction ? '.' + fraction : '');
}
function npv(flows: Rational[], rate: Rational): Rational {
  const factor = add(one, div(rate, hundred));
  let result = zero;
  for (let i = flows.length - 1; i >= 0; i--) result = add(flows[i], div(result, factor));
  return result;
}
export interface CalculationInput {
  version: string;
  revenueTHB: string | string[];
  costJPY: string | string[];
  initialInvestmentJPY: string;
  exchangeRate: string;
  taxRate: string;
  discountRate: string;
}
export interface CalculationResult {
  npvJPY: string;
  irrPercent: string;
  paybackYear: number | null;
  rows: { revenue: string[]; cost: string[]; tax: string[]; cashFlow: string[]; cumulative: string[] };
}
/** Compute without floating-point arithmetic; rational intermediates are not rounded. */
export function calculate(input: CalculationInput): CalculationResult {
  if (!['1.0.0', '2.0.0'].includes(input.version)) throw new Error('未知の計算版です。');
  const values = (value: string | string[]) => {
    if (Array.isArray(value) && (value.length !== 10 || input.version === '1.0.0')) throw new Error('年次値を確認してください。');
    return (Array.isArray(value) ? value : Array<string>(10).fill(value)).map(decimal);
  };
  const revenues = values(input.revenueTHB), costs = values(input.costJPY);
  const investment = decimal(input.initialInvestmentJPY), exchange = decimal(input.exchangeRate);
  const taxRate = decimal(input.taxRate), discount = decimal(input.discountRate);
  if ([...revenues, ...costs, investment].some(x => x.n < 0n) || exchange.n <= 0n || [taxRate, discount].some(x => x.n < 0n || sub(x, hundred).n > 0n)) throw new Error('計算に必要な前提または計算条件を確認してください。');
  const flows = [neg(investment)], revenue = [zero], cost = [zero], tax = [zero], cumulative = [neg(investment)];
  let paybackYear: number | null = null;
  for (let i = 0; i < 10; i++) {
    revenue.push(mul(revenues[i], exchange)); cost.push(costs[i]);
    const profit = sub(revenue[i + 1], costs[i]);
    tax.push(profit.n > 0n ? mul(profit, div(taxRate, hundred)) : zero);
    flows.push(sub(profit, tax[i + 1]));
    cumulative.push(add(cumulative[i], flows[i + 1]));
    if (paybackYear === null && (investment.n === 0n || cumulative[i + 1].n >= 0n)) paybackYear = i + 1;
  }
  // A single sign change proves at most one positive root by Descartes' rule.
  const signs = flows.filter(x => x.n !== 0n).map(x => x.n > 0n);
  const changes = signs.slice(1).filter((x, i) => x !== signs[i]).length;
  if (changes > 1) throw new Error('IRRの根の一意性を判定できません。');
  let low = 0n, high = 100000000000000n; // percentage in billionths
  const at = (n: bigint) => npv(flows, rat(n, 10000000000n));
  const loValue = at(low), hiValue = at(high);
  if (!changes || (loValue.n !== 0n && hiValue.n !== 0n && (loValue.n > 0n) === (hiValue.n > 0n))) throw new Error('IRRの根が存在しません。');
  if (loValue.n === 0n) high = low;
  else if (hiValue.n === 0n) low = high;
  else while (high - low > 1n) {
    const mid = (low + high) / 2n, value = at(mid);
    if (value.n === 0n) { low = mid; high = mid; break; }
    if ((value.n > 0n) === (loValue.n > 0n)) low = mid; else high = mid;
  }
  const lowRounded = rounded(rat(low, 10000000000n), 4), highRounded = rounded(rat(high, 10000000000n), 4);
  if (lowRounded !== highRounded) throw new Error('IRRの計算精度が不足しています。');
  const format = (row: Rational[]) => row.map(x => rounded(x, 8));
  return { npvJPY: rounded(npv(flows, discount), 0), irrPercent: lowRounded, paybackYear, rows: { revenue: format(revenue), cost: format(cost), tax: format(tax), cashFlow: format(flows), cumulative: format(cumulative) } };
}
