/**
 * Backwards-compatible re-export shim.
 * The implementation has moved to ./pdf/estimate.tsx so that invoice/delivery/
 * purchase-order/cover-letter generators can share the same base primitives.
 * Existing call sites continue to import from '../lib/estimate-pdf'.
 */
export * from './pdf/estimate.js';
