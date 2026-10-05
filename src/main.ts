import './ui/styles.css';
import { App } from './ui/app';
import { boardScreen } from './ui/board';
import { endScreen } from './ui/end';
import { initFx } from './ui/fx';
import { installCursors } from './ui/icons';
import { installShortcuts } from './ui/records';
import { howtoScreen, openPause, setupScreen, titleScreen } from './ui/menus';
import { shopScreen } from './ui/shop';
import { tableScreen } from './ui/table';

initFx();
installCursors();
const app = new App(document.getElementById('app')!);
installShortcuts(app);
app.register('title', titleScreen);
app.register('setup', setupScreen);
app.register('howto', howtoScreen);
app.register('board', boardScreen);
app.register('table', tableScreen);
app.register('shop', shopScreen);
app.register('end', endScreen);
app.go('title');

addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (app.closeTopModal()) return;
  if (app.run && !app.busy && ['board', 'table', 'shop'].includes(app.viewKey)) openPause(app);
});

// Debug handle for playtesting from the console.
(window as unknown as { crapshoot: App }).crapshoot = app;
