import * as debug from './builtins/debugger';
import { plugins, themes } from './managers';
import storage from './api/storage';
import * as api from './api';

declare global {
	var unbound: typeof api;
}

const Settings = storage.getStore('unbound');
const debugEnabled = Settings.get('debugger.enabled', false);

if (debugEnabled) {
	debug.start();
}

plugins.initialize();
themes.initialize();

window.unbound = api;

export default api;
