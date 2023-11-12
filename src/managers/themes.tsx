import Manager, { ManagerType } from './base';
import { createPatcher } from '@patcher';
import Storage from '@api/storage';
import { findInReactTree } from '@utilities';

import type { Addon, Resolveable } from '@typings/managers';

class Themes extends Manager {
	public patcher: ReturnType<typeof createPatcher>;
	public extension: string = 'json';
	public module: any;

	constructor() {
		super(ManagerType.Themes);

		this.patcher = createPatcher('themes');
		this.icon = 'ic_paint_brush';
	}

	initialize(mdl: any): void {
		this.module = mdl;

		for (const theme of window.UNBOUND_THEMES ?? []) {
			const { manifest, bundle } = theme;

			this.load(bundle, manifest);
		}
	}

	override async start(entity: Resolveable): Promise<void> {
		const addon = this.resolve(entity);
		if (!addon || addon.failed || Storage.get('unbound', 'recovery', false)) return;

		try {
			const { instance } = addon;

			if (instance.raw) {
				if (!instance.raw.PRIMARY_660) {
					instance.raw.PRIMARY_660 = instance?.semantic?.BACKGROUND_PRIMARY[0];
				}

				const entries = Object.entries(instance.raw);

				for (const [key, value] of entries) {
					this.module.RawColor[key] = value;
					this.module.default.unsafe_rawColors[key] = value;
				}
			}

			if (instance.semantic) {
				const orig = this.module.default.meta.resolveSemanticColor;

				this.module.default.meta.resolveSemanticColor = function (theme: string, ref: { [key: symbol]: string; }) {
					const key = ref[Object.getOwnPropertySymbols(ref)[0]];

					if (instance.semantic[key]) {
						const index = { dark: 0, light: 1, amoled: 2 }[theme.toLowerCase()] || 0;
						const unparsedColor = instance.semantic[key];
						const color = unparsedColor[index] ?? unparsedColor[0];

						if (key === 'CHAT_BACKGROUND' && typeof instance.background?.opacity === 'number') {
							return (color ?? '#000000') + Math.round(instance.background.opacity * 255).toString(16);
						}

						if (color) return color;
					}

					return orig.call(this, theme === 'darker' ? 'dark' : theme, ref);
				};
			}

			if (instance.background) this.applyBackground(addon);
		} catch (e) {
			this.logger.error('Failed to apply theme:', e.message);
		}

		this.emit('applied', addon);
		this.logger.log(`${addon.id} started.`);
	}

	async applyBackground(addon: Addon) {
		// Avoid circular dependency
		const { findByName, findByProps } = await import('@metro');
		const { Theme } = await import('@metro/stores');
		const { instance: { background } } = addon;

		const Chat = findByName('MessagesWrapperConnected', { interop: false });
		const { MessagesWrapper } = findByProps('MessagesWrapper');

		this.patcher.after(Chat, 'default', (_, __, res) => {
			const index = { dark: 0, light: 1, amoled: 2 }[Theme.theme.toLowerCase()] || 0;

			return <ReactNative.ImageBackground
				blurRadius={typeof background.blur === 'number' ? background.blur : 0}
				style={{ flex: 1, height: '100%' }}
				source={{ uri: typeof background.url === 'string' ? background.url : background.url[index] ?? background.url[0] }}
				children={res}
			/>;
		});

		this.patcher.after(MessagesWrapper.prototype, 'render', (_, __, res) => {
			const Messages = findInReactTree(res, x =>
				'HACK_fixModalInteraction' in x.props
				&& x.props?.style
			);

			if (Messages) {
				Messages.props.style = [Messages.props.style, { backgroundColor: '#00000000' }];
			}
		});
	}

	override toggle(entity: Resolveable): void {
		const addon = this.resolve(entity);
		if (!addon) return;

		const enabled = this.isEnabled(addon.id);

		if (!enabled) {
			this.enable(addon);
		} else {
			this.disable(addon);
		}

		this.emit('toggle');
	}

	override enable(entity: Resolveable): void {
		const addon = this.resolve(entity);
		if (!addon) return;

		try {
			this.settings.set('applied', addon.id);

			if (!addon.started) {
				this.start(addon);
			}
		} catch (e) {
			this.logger.error(`Failed to enable ${addon.data.id}:`, e.message);
		}
	}

	override disable(entity: Resolveable): void {
		const addon = this.resolve(entity);
		if (!addon) return;

		try {
			this.settings.set('applied', null);

			if (addon.started) {
				this.stop(addon);
			}
		} catch (e) {
			this.logger.error(`Failed to stop ${addon.data.id}:`, e.message);
		}
	}

	override isEnabled(id: string): boolean {
		return this.settings.get('applied', null) === id;
	}

	override handleBundle(bundle: string): any {
		return typeof bundle === 'object' ? bundle : JSON.parse(bundle);
	}
}

export default new Themes();