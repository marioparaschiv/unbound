import { findInReactTree, unitToHex, withoutOpacity } from '@utilities';
import type { Resolveable } from '@typings/managers';
import { ImageBackground } from 'react-native';
import { createPatcher } from '@patcher';
import Storage from '@api/storage';

import Manager, { ManagerType } from './base';

type SemanticKey = string;
type RawKey = string;

interface Theme {
	semantic: Record<SemanticKey, {
		type: 'color' | 'raw';
		value: string;
		opacity?: number;
	}>;

	raw: Record<RawKey, string>;
	type: 'dark' | 'light';
	background?: {
		blur?: number;
		opacity?: number;
		url: string;
	};
}

class Themes extends Manager {
	public patcher: ReturnType<typeof createPatcher>;
	public extension: string = 'json';
	public module: any;
	private currentTheme = null;

	constructor() {
		super(ManagerType.Themes);

		this.patcher = createPatcher('themes');
		this.icon = 'ic_paint_brush';
	}

	async initialize(mdl: any) {
		this.module = mdl;
		this.module._Theme = { ...this.module.Theme };
		this.module._RawColor = { ...this.module.RawColor };

		for (const theme of window.UNBOUND_THEMES ?? []) {
			const { manifest, bundle } = theme;

			this.load(bundle, manifest);
		}

		const self = this;

		const { findStore } = await import('@api/metro');
		const ThemeStore = findStore('Theme');

		this.currentTheme = ThemeStore.theme;

		Object.keys(this.module.RawColor).forEach(key => {
			Object.defineProperty(self.module.RawColor, key, {
				configurable: true,
				enumerable: true,
				get: () => {
					const theme = self.entities.get(self.currentTheme);

					if (theme) {
						return theme.instance.raw?.[key] ?? self.module._RawColor[key];
					}

					return self.module._RawColor[key];
				}
			});
		});

		const orig = this.module.default.internal.resolveSemanticColor;

		this.module.default.internal.resolveSemanticColor = function (theme: string, ref: { [key: symbol]: string; }) {
			if (!Object.values(self.module.Theme).includes(theme)) {
				return orig.call(this, theme, ref);
			}

			const appliedTheme = self.entities.get(theme);

			if (!appliedTheme) {
				return orig.call(this, theme, ref);
			}

			const { instance } = appliedTheme;
			const key = ref[Object.getOwnPropertySymbols(ref)[0]];
			const item = instance.semantic?.[key];

			try {
				let color = null;

				if (!item) color = orig.call(this, 'dark', ref);
				else color = self.parseColor(item, theme);

				if (key === 'CHAT_BACKGROUND' && typeof instance.background?.opacity === 'number') {
					return (color ?? '#000000') + Math.round(instance.background.opacity * 255).toString(16);
				}

				return item?.opacity ? withoutOpacity(color) + unitToHex(item.opacity) : color;
			} catch (e) {
				console.error('Failed to resolve color:', e);
			}

			return orig.call(this, 'dark', ref);
		};

		this.applyBackground();
		this.initialized = true;
	}

	parseColor(item: Record<string, any>, theme: string) {
		if (!item?.value) {
			return item;
		}

		if (item?.type === 'raw') {
			this.currentTheme = theme;
			return this.module.RawColor[item.value];
		};

		if (item?.type === 'color') {
			return item.value.replace('transparent', 'rgba(0, 0, 0, 0)');
		}
	}

	override async start(entity: Resolveable): Promise<void> {
		const addon = this.resolve(entity);
		if (!addon || addon.failed || Storage.get('unbound', 'recovery', false)) return;

		try {
			const { id } = addon;

			this.module.Theme[id.toUpperCase().replace('.', '_')] = id;

			Object.keys(this.module.Shadow).forEach(key => {
				this.module.Shadow[key][id] = this.module.Shadow[key]['darker'];
			});

			Object.keys(this.module.SemanticColor).forEach(key => {
				this.module.SemanticColor[key][id] = this.module.SemanticColor[key]['darker'];
			});
		} catch (e) {
			this.logger.error('Failed to apply theme:', e.message);
		}

		this.emit('applied', addon);
		this.logger.log(`${addon.id} started.`);
	}

	async applyBackground() {
		// Avoid circular dependency
		const { findByName, findByProps } = await import('@api/metro');
		const { Theme } = await import('@api/metro/stores');

		const Chat = findByName('MessagesWrapperConnected', { interop: false });
		const { MessagesWrapper } = findByProps('MessagesWrapper');

		this.patcher.after(Chat, 'default', (_, __, res) => {
			const theme = this.entities.get(Theme.theme);

			if (!theme || !theme.instance.background) return res;

			const { instance: { background } } = theme;

			return (
				<ImageBackground
					blurRadius={typeof background.blur === 'number' ? background.blur : 0}
					style={{ flex: 1, height: '100%' }}
					source={{ uri: background.url }}
				>
					{res}
				</ImageBackground>
			);
		});

		this.patcher.after(MessagesWrapper.prototype, 'render', (_, __, res) => {
			const theme = this.entities.get(Theme.theme);

			if (!theme || !theme.instance.background) return res;

			const Messages = findInReactTree(res, x =>
				'HACK_fixModalInteraction' in x.props
				&& x.props?.style
			);

			if (Messages) {
				Messages.props.style = [Messages.props.style, { backgroundColor: '#00000000' }];
			}
		});
	}

	isDiscordTheme(id: string) {
		return Object.values(this.module._Theme).includes(id);
	}

	override isEnabled(id: string): boolean {
		return true;
	}

	override handleBundle(bundle: string): any {
		return typeof bundle === 'object' ? bundle : JSON.parse(bundle);
	}
}

export default new Themes();