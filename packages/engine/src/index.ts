export { analyze } from './analyze';
export { annuity, isDepreciable } from './investment';
export { fixedRowType } from './fixed';
export { feeRate, serviceShare, unitEconomics } from './unit';
export { floorPrice, roundPrice } from './pricing';
export { daysBetween, PRICE_MAP_MIN, priceMap } from './price-map';
export { EXPR_VARIABLES, ExprError, evaluateExpr, parseExpr } from './expr';
export type * from './types';

/** PDF ve `reports.engine_version` için; formül değişince artırılır. */
export const ENGINE_VERSION = '1.2.0';
