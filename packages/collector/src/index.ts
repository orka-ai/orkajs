/**
 * @orka-js/collector
 * 
 * This package re-exports everything from @orka-js/devtools for backward compatibility.
 * Use @orka-js/devtools directly for new projects.
 * 
 * @example
 * ```typescript
 * import { devtools, trace, withTrace } from '@orka-js/collector';
 * 
 * const { tracer, stop } = await devtools({ source: 'local' });
 * ```
 */
export * from '@orka-js/devtools';

// Re-export devtools as collector for semantic clarity
export { devtools as collector } from '@orka-js/devtools';
