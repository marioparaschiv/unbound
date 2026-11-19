const MOD_GLOBALS: Record<string, string> = {
	vendetta: 'Vendetta',
	bunny: 'Bunny',
	revenge: 'Revenge',
	kettu: 'Kettu',
	enmity: 'Enmity',
	pyon: 'Pyoncord',
};

/**
 * @description Names other Discord mods running in the same JavaScript runtime, from the globals each one sets.
 * @param scope The global object to look in.
 * @returns The mods' names.
 */
export function otherDiscordMods(scope: object = globalThis): string[] {
	return Object.entries(MOD_GLOBALS)
		.filter(
			([key]) => Reflect.get(scope, key) !== undefined && Reflect.get(scope, key) !== null,
		)
		.map(([, name]) => name);
}

export default otherDiscordMods;
