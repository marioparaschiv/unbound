import type { ApplicationCommand } from '@typings/api/commands';
import { DeviceInfo, BundleInfo } from '@api/native';


export default {
	name: 'debug',
	description: 'Prints out information to help debug unbound.',

	execute: () => {
		const payload = [];

		const Runtime = (HermesInternal as any).getRuntimeProperties();

		payload.push('**Debug Info:**');
		payload.push(`> **Client**: ${window.unbound.version}`);
		payload.push(`> **Loader**: ${window.UNBOUND_LOADER?.origin ?? 'N/A'} - ${window.UNBOUND_LOADER?.platform ?? 'N/A'} (Version ${window.UNBOUND_LOADER?.version ?? 'N/A'})`);
		payload.push(`> **Discord**: ${BundleInfo.Version}`);
		payload.push(`> **Build**: ${BundleInfo.Build} on ${BundleInfo.ReleaseChannel}`);
		payload.push(`> **Hermes**: ${Runtime['OSS Release Version']}`);
		payload.push(`> **Bytecode**: ${Runtime['Bytecode Version']}`);
		payload.push(`> **Device**: ${DeviceInfo.device} (${DeviceInfo.systemVersion})`);

		const content = payload.join('\n');

		return { content };
	}
} as ApplicationCommand;