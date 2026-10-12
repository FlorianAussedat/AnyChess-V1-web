import { register } from 'node:module';

register('./load-tsx.mjs', {
  parentURL: import.meta.url,
});
