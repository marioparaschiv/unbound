// The settings of whichever plugin bundles this code. Each plugin's build resolves `@unbound-app/settings` to its own
// settings.ts, and its generated `src/unbound-settings.d.ts` types it; this stand-in only type-checks the shared package.
declare module '@unbound-app/settings' {
	/** The plugin's settings: reads apply defaults, and writes are validated and saved to its Bucket. */
	export type Settings = Record<string, unknown>;
	/** Every boolean setting's dot-separated key. */
	export type BooleanSettingKey = string;
	/** The plugin's settings, as the schema reads them. */
	export const settings: Settings;
}
