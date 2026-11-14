import type { PluginContext } from '@unbound-app/api/native';

import { liveMarkdown } from '~/native/live-markdown';

let session: { dispose(): void } | undefined;

export function start(context: PluginContext) {
	session = liveMarkdown(context.native);
}

export function stop() {
	session?.dispose();
	session = undefined;
}
