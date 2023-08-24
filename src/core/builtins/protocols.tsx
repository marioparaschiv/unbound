import { BuiltIn } from '@typings/core/builtins';
import { createPatcher } from '@patcher';
import plugins from '@managers/plugins';
import themes from '@managers/themes';
import { ManagerType } from '@managers/base';
import { Addon } from '@typings/managers';

const Patcher = createPatcher('protocols');

export const data: BuiltIn['data'] = {
	id: 'modules.protocols',
	default: true
};

const { NativeModules: { DCDChatManager }, Linking } = ReactNative;

const actions = {
	install(parameters: URLSearchParams) {
		const [type, url] = getBulkParameters('type', 'url', parameters);

		if (![type, url].every(k => typeof k === 'string')) return;

		const addon = getAppropriateAddon(type);

		addon.install(url)
			.then(() => console.log(`Successfully installed ${type}!`))
			.catch((e) => console.error(`Failed to install ${type}: ${e.message || e}`));
	},

	uninstall(parameters: URLSearchParams) {
		const [type, name] = getBulkParameters('type', 'name', parameters);

		if (![type, name].every(k => typeof k === 'string')) return;

		const addon = getAppropriateAddon(type);

		addon.delete(getAddonIdByName(addon.entities, name))
			.then(() => console.log(`Successfully uninstalled ${type}!`))
			.catch((e) => console.error(`Failed to install ${type}: ${e.message || e}`));
	}
};

export function initialize() {
	Patcher.before(DCDChatManager, 'updateRows', (_, args) => {
		const rows = JSON.parse(args[1]);

		for (const row of rows) {
			if (row && row?.message && row?.type === 1 && row.message?.content) {
				row.message.content = resolveProtocols(row.message.content);
			}
		}

		args[1] = JSON.stringify(rows);
	});

	Patcher.instead(Linking, 'openURL', (self, args, orig) => {
		if (!args[0].startsWith('unbound://')) return orig.apply(self, args);

		const parameters = new URLSearchParams(args[0].split('?')[1]);
		const action = parameters.get('action');

		if (!Object.keys(actions).includes(action)) return orig.apply(self, args);

		// TODO: Open one of our custom toasts confirming that the action has been called
		return actions[action]?.(parameters);
	});
}

export function shutdown() {
	Patcher.unpatchAll();
}

function getBulkParameters(...args: (URLSearchParams | string)[]): any[] {
	const params = args.pop() as URLSearchParams;
	const results = [];

	for (const param of args) {
		results.push(params.get(param as string));
	}

	return results;
}

function getAppropriateAddon(type: string) {
	switch (type) {
		case ManagerType.Plugins:
			return plugins;
		case ManagerType.Themes:
			return themes;
		default:
			console.warn(`Not a valid type! (${type})`);
			return;
	}
}

function getAddonIdByName(entities: Map<string, Addon>, name: string) {
	for (const [key, value] of entities.entries()) {
		if (value.data.name === name) return key;
	}

	return null;
}

function resolveProtocols(content) {
	return content.map(item => {
		typeof item.content === 'object'
			&& (item.content = resolveProtocols(item.content));

		if (typeof item?.content === 'string'
			&& !['codeBlock', 'inlineCode'].includes(item?.type)
			&& item?.content?.match(/[a-zA-Z]+\:\/\//g)
		) return {
			type: 'link',
			target: item.content,
			content: [{ type: 'text', content: item.content }]
		};

		return item;
	});
}