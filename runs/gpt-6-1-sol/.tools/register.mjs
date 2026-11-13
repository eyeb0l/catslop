import { registerHooks } from 'node:module';
registerHooks({resolve(specifier, context, nextResolve) {
  if (specifier === 'playwright') return nextResolve(new URL('./node_modules/playwright/index.mjs', import.meta.url).href, context);
  return nextResolve(specifier, context);
}});
