import { settings } from '@unbound-app/settings';

/**
 * @description Logs one setting, proving plugin code reads them.
 * @returns Nothing.
 */
export function start() {
	logger.log('Settings Demo started; style is', settings.style);
}
