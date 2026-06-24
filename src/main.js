/**
 * App entry point. Import this from index.html.
 */

import { initApp } from './ui/app.js';

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
