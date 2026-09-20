// Calculs et formats des devis / factures. Les montants sont en DZD, arrondis
// au centime ; la TVA algérienne standard est de 19 %.

export const DEFAULT_VAT_RATE = 19;

export const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export interface PricedLine {
  quantity: number;
  unitPrice: number;
}

export function computeTotals(lines: PricedLine[], vatRate: number) {
  const subtotal = round2(lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0));
  const vatAmount = round2((subtotal * vatRate) / 100);
  return { subtotal, vatAmount, total: round2(subtotal + vatAmount) };
}

// « 22 900,00 DA » — espaces classiques (pas d'espace insécable fine, que les
// polices standard des PDF ne savent pas dessiner).
export function formatAmount(value: number, currency = 'DA'): string {
  const [integer, decimals] = round2(value).toFixed(2).split('.');
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${grouped},${decimals} ${currency}`;
}

const UNITS = [
  'zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix',
  'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize',
];
const TENS = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante'];

// `terminal` = le nombre n'est suivi d'aucun autre mot : « quatre-vingts »,
// « deux cents » prennent alors leur « s » (pas devant « mille »).
function below100(n: number, terminal: boolean): string {
  if (n < 17) return UNITS[n];
  if (n < 20) return `dix-${UNITS[n - 10]}`;
  if (n < 70) {
    const tens = Math.floor(n / 10);
    const unit = n % 10;
    if (unit === 0) return TENS[tens];
    return unit === 1 ? `${TENS[tens]} et un` : `${TENS[tens]}-${UNITS[unit]}`;
  }
  if (n < 80) return n === 71 ? 'soixante et onze' : `soixante-${below100(n - 60, false)}`;
  if (n === 80) return terminal ? 'quatre-vingts' : 'quatre-vingt';
  return `quatre-vingt-${below100(n - 80, false)}`;
}

function below1000(n: number, terminal: boolean): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  let out = '';
  if (hundreds > 0) {
    out = hundreds === 1 ? 'cent' : `${UNITS[hundreds]} cent`;
    if (rest === 0 && hundreds > 1 && terminal) out += 's';
  }
  if (rest > 0) out += `${out ? ' ' : ''}${below100(rest, terminal)}`;
  return out;
}

export function numberToFrench(value: number): string {
  const n = Math.floor(value);
  if (n === 0) return 'zéro';
  const millions = Math.floor(n / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1000);
  const rest = n % 1000;
  const parts: string[] = [];
  if (millions) parts.push(`${millions === 1 ? 'un' : below1000(millions, true)} million${millions > 1 ? 's' : ''}`);
  if (thousands) parts.push(thousands === 1 ? 'mille' : `${below1000(thousands, false)} mille`);
  if (rest) parts.push(below1000(rest, true));
  return parts.join(' ');
}

// « vingt-deux mille neuf cents dinars algériens et cinquante centimes »
export function amountInWords(value: number): string {
  const rounded = round2(value);
  const dinars = Math.floor(rounded);
  const cents = Math.round((rounded - dinars) * 100);
  const dinarsText = `${numberToFrench(dinars)} dinar${dinars > 1 ? 's' : ''} algérien${dinars > 1 ? 's' : ''}`;
  return cents > 0 ? `${dinarsText} et ${numberToFrench(cents)} centime${cents > 1 ? 's' : ''}` : dinarsText;
}
