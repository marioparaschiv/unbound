import type { ApplicationCommand } from '@typings/api/commands';
import { DeviceInfo, BundleInfo } from '@api/native';

export default {
  name: 'debug',
  description: 'Prints out information to help debug enmity.',

  execute: () => {
    const payload = [];

    const Runtime = (HermesInternal as any).getRuntimeProperties();

    payload.push('**Debug Info:**\n');
    payload.push(`> **Enmity:** ${window.enmity.version}`);
    payload.push(`> **Loader:** ${window.loader?.version ?? 'N/A'} (${window.loader?.type ?? 'N/A'})`);
    payload.push(`> **Discord:** ${BundleInfo.Version} (Build ${BundleInfo.Build} on ${BundleInfo.ReleaseChannel})`);
    payload.push(`> **Hermes:** ${Runtime['OSS Release Version']}`);
    payload.push(`> **Bytecode:** ${Runtime['Bytecode Version']}`);
    payload.push(`> **Device:** ${DeviceInfo.device} (${DeviceInfo.systemVersion})`);

    const content = payload.join('\n');

    return { content };
  }
} as ApplicationCommand;