import type { BuiltIn } from '@typings/core/builtins';
import { ReactNative as RN } from '@metro/common';
import { ManagerType } from '@managers/base';
import { createPatcher } from '@patcher';
import { createLogger } from '@logger';
import { findByName } from '@metro';
import { managers } from '@api';
import Toasts from '@api/toasts';

const Patcher = createPatcher('protocols');
const Logger = createLogger('Protocol');

export const data: BuiltIn['data'] = {
	id: 'modules.protocols',
	default: true
};

const RowManager = findByName('RowManager');

const actions = {
	async install(parameters: URLSearchParams, type: ManagerType) {
		const [url] = getBulkParameters('url', parameters);
		if (typeof url !== 'string') return;
		const manager = getManager(type);

		try {
			await manager.installWithToast(url);
			Logger.success(`Successfully installed ${type}!`);
		} catch (e) {
			Logger.error(`Failed to install ${type}: ${e.message || e}`);
		}
	},

	async uninstall(parameters: URLSearchParams, type: ManagerType) {
		const [id] = getBulkParameters('id', parameters);

		const manager = getManager(type);
		const addon = manager.resolve(id);

		if (!addon) {
			Logger.warn('Tried to uninstall unknown addon:', id);

			return Toasts.showToast({
				title: 'Unknown Addon',
				content: 'You don\'t have this addon installed.'
			});
		}

		try {
			await manager.delete(id);
			Logger.success(`Successfully uninstalled ${type}!`);
		} catch (e) {
			console.error(`Failed to install ${type}: ${e.message || e}`);
		}
	}
};

const ActionTypes = Object.keys(actions);

export function initialize() {
	Patcher.after(RowManager.prototype, 'generate', (_, args, res) => {
		if (res?.type === 1 && res.message.content) {
			res.message.content = resolveProtocols(res.message.content);
		}
	});

	Patcher.instead(RN.Linking, 'openURL', (self, args, orig) => {
		const [link] = args;

		if (!link.startsWith('unbound://')) {
			return orig.apply(self, args);
		}

		const [url, params] = link.split('?');
		const [manager] = url.replace('unbound://', '').split('/');
		const parameters = new URLSearchParams(params);
		const action = parameters.get('action');

		if (!ActionTypes.includes(action)) {
			return orig.apply(self, args);
		}

		return actions[action]?.(parameters, manager);
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

function getManager(type: string) {
	return managers[type] ?? managers[type + 's'];
}

function resolveProtocols(content) {
	for (let i = 0; i < content.length; i++) {
		const item = content[i];

		if (
			typeof item?.content !== 'string' ||
			['codeBlock', 'inlineCode'].includes(item.type) ||
			!item.content.match(/[a-zA-Z]+\:\/\//g)
		) continue;

		content[i] = {
			type: 'link',
			target: item.content,
			content: [{ type: 'text', content: item.content }]
		};
	}

	return content;
}