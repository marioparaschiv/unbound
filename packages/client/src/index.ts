import { start } from '~/debug';

import * as api from './api';

declare global {
	var unbound: typeof api;
}

start();

window.unbound = api;

export default api;
