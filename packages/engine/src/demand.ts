// §9 Talep uyumu (0–100). Ağırlıklar ve ifadeler arketipten gelir.
// Seçim alanları (turnout, elec) burada okunmaz (CLAUDE.md kural 5).
import { evaluateExpr, type ExprScope } from './expr';
import { n } from './math';
import type { AnalysisInput, DemandFitResult, EngineArchetype, Level } from './types';

export const DEMAND_LEVELS = { hi: 67, mid: 40 } as const;

export function incomeIndex(input: AnalysisInput): number | null {
  const inc = n(input.demo.inc);
  const incCity = n(input.demo.incCity);
  return incCity > 0 && inc > 0 ? (inc / incCity) * 100 : null;
}

export function demandFit(input: AnalysisInput, archetype: EngineArchetype): DemandFitResult {
  const pop = n(input.pop);
  const idx = incomeIndex(input);
  const dayRatio = pop > 0 ? n(input.demo.day) / pop : 0;
  const scope: ExprScope = {
    a1: n(input.demo.a1),
    a2: n(input.demo.a2),
    a3: n(input.demo.a3),
    hh: n(input.demo.hh),
    pop,
    idx,
    dayR: dayRatio,
  };
  const features = archetype.demandFit.features.map((f) => ({
    key: f.key,
    weight: f.weight,
    value: evaluateExpr(f.expr, scope),
  }));
  const score = features.reduce((a, f) => a + f.weight * f.value, 0);
  const level: Level = score >= DEMAND_LEVELS.hi ? 'hi' : score >= DEMAND_LEVELS.mid ? 'mid' : 'lo';
  return { score, level, incomeIndex: idx, dayRatio, features };
}
