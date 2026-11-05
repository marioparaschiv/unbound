import { settings } from '@unbound-app/settings';

/**
 * @description Logs one setting, proving plugin code reads them. Patches and depends on no Discord module.
 */
export function startDemo(): void {
	logger.log('Settings Demo started; style is', settings.style);
}
