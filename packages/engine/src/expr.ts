// Arketip dosyasındaki talep uyumu ifadeleri için güvenli değerlendirici (SPEC-archetypes §2).
// eval yok. İzin verilenler: sayılar, `null`, beyaz listedeki değişkenler, clamp(),
// + - * /, tekli -, ==, !=, ?:, parantez.

export const EXPR_VARIABLES = ['a1', 'a2', 'a3', 'idx', 'dayR', 'pop', 'hh'] as const;
export type ExprVariable = (typeof EXPR_VARIABLES)[number];
export type ExprValue = number | null;
export type ExprScope = Record<ExprVariable, ExprValue>;

type Node =
  | { t: 'num'; v: number }
  | { t: 'null' }
  | { t: 'var'; name: ExprVariable }
  | { t: 'neg'; x: Node }
  | { t: 'bin'; op: '+' | '-' | '*' | '/' | '==' | '!='; a: Node; b: Node }
  | { t: 'cond'; c: Node; a: Node; b: Node }
  | { t: 'clamp'; x: Node };

export class ExprError extends Error {}

function tokenize(src: string): string[] {
  // Yapışkan regex her çağrıda yeniden kurulur: modül düzeyinde lastIndex durumu tutulmaz.
  const token = /\s*(\d+(?:\.\d+)?|[A-Za-z_][A-Za-z0-9_]*|==|!=|[-+*/()?:])/y;
  const out: string[] = [];
  while (token.lastIndex < src.length && !/^\s*$/.test(src.slice(token.lastIndex))) {
    const start = token.lastIndex;
    const m = token.exec(src);
    if (!m || m[1] === undefined) throw new ExprError(`Geçersiz karakter: "${src.slice(start)}"`);
    out.push(m[1]);
  }
  return out;
}

export function parseExpr(src: string): Node {
  const toks = tokenize(src);
  let i = 0;
  const peek = () => toks[i];
  const take = (expected?: string) => {
    const tok = toks[i++];
    if (tok === undefined || (expected !== undefined && tok !== expected))
      throw new ExprError(`"${expected ?? 'ifade'}" bekleniyordu: ${src}`);
    return tok;
  };

  const cond = (): Node => {
    const c = equality();
    if (peek() !== '?') return c;
    take('?');
    const a = cond();
    take(':');
    const b = cond();
    return { t: 'cond', c, a, b };
  };
  const equality = (): Node => {
    let a = additive();
    while (peek() === '==' || peek() === '!=') {
      const op = take() as '==' | '!=';
      a = { t: 'bin', op, a, b: additive() };
    }
    return a;
  };
  const additive = (): Node => {
    let a = multiplicative();
    while (peek() === '+' || peek() === '-') {
      const op = take() as '+' | '-';
      a = { t: 'bin', op, a, b: multiplicative() };
    }
    return a;
  };
  const multiplicative = (): Node => {
    let a = unary();
    while (peek() === '*' || peek() === '/') {
      const op = take() as '*' | '/';
      a = { t: 'bin', op, a, b: unary() };
    }
    return a;
  };
  const unary = (): Node => {
    if (peek() === '-') {
      take('-');
      return { t: 'neg', x: unary() };
    }
    return primary();
  };
  const primary = (): Node => {
    const tok = take();
    if (tok === '(') {
      const x = cond();
      take(')');
      return x;
    }
    if (/^\d/.test(tok)) return { t: 'num', v: Number(tok) };
    if (tok === 'null') return { t: 'null' };
    if (tok === 'clamp') {
      take('(');
      const x = cond();
      take(')');
      return { t: 'clamp', x };
    }
    if ((EXPR_VARIABLES as readonly string[]).includes(tok)) return { t: 'var', name: tok as ExprVariable };
    throw new ExprError(`İzin verilmeyen ad: "${tok}" (${src})`);
  };

  const root = cond();
  if (i !== toks.length) throw new ExprError(`Fazla belirteç: "${toks.slice(i).join(' ')}" (${src})`);
  return root;
}

const num = (v: ExprValue, src: string): number => {
  if (v === null) throw new ExprError(`null ile aritmetik: ${src}`);
  return v;
};

function evalNode(node: Node, scope: ExprScope, src: string): ExprValue {
  switch (node.t) {
    case 'num':
      return node.v;
    case 'null':
      return null;
    case 'var':
      return scope[node.name];
    case 'neg':
      return -num(evalNode(node.x, scope, src), src);
    case 'clamp':
      return Math.min(1, Math.max(0, num(evalNode(node.x, scope, src), src)));
    case 'cond': {
      const c = evalNode(node.c, scope, src);
      return c !== null && c !== 0 ? evalNode(node.a, scope, src) : evalNode(node.b, scope, src);
    }
    case 'bin': {
      const a = evalNode(node.a, scope, src);
      const b = evalNode(node.b, scope, src);
      if (node.op === '==') return a === b ? 1 : 0;
      if (node.op === '!=') return a !== b ? 1 : 0;
      const x = num(a, src);
      const y = num(b, src);
      if (node.op === '+') return x + y;
      if (node.op === '-') return x - y;
      if (node.op === '*') return x * y;
      return x / y;
    }
  }
}

export function evaluateExpr(src: string, scope: ExprScope): number {
  const v = evalNode(parseExpr(src), scope, src);
  return num(v, src);
}
