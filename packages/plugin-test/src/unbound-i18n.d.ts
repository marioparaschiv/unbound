// The shape `ubd build` generates from a plugin's i18n/en-US.json, so this smoke test types like a real plugin.

declare module '@unbound-app/i18n' {
	/** Every key of the plugin's en-US.json. */
	export type MessageKey = 'HELLO_DESC';

	global {
		/** Gives the plugin's commands its message keys. */
		// oxlint-disable-next-line typescript/consistent-type-definitions -- merging needs an interface.
		interface UnboundMessageKeys extends Record<MessageKey, true> {}
	}
}
