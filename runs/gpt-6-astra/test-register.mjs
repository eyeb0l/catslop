// Let the repository's unchanged scripts use the pinned dependency installed
// inside this run. No files outside this run are needed for test setup.
import { registerHooks } from 'node:module';
const playwright = import.meta.resolve('playwright');
registerHooks({resolve(specifier, context, nextResolve) {
  return nextResolve(specifier === 'playwright' ? playwright : specifier, context);
}});
