export { analyze } from './analyze';
export { annuity, isDepreciable } from './investment';
export { fixedRowType } from './fixed';
export { feeRate, unitEconomics } from './unit';
export { roundPrice } from './pricing';
export { EXPR_VARIABLES, ExprError, evaluateExpr, parseExpr } from './expr';
export type * from './types';

/** PDF ve `reports.engine_version` için; formül değişince artırılır. */
export const ENGINE_VERSION = '1.0.0';
