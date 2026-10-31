import type { ContextMenuCommandSuccessPayload } from '@sapphire/framework';
import { Events, Listener } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';

import { isDebugLogging, logSuccessCommand } from '~/lib/log-command';

@ApplyOptions<Listener.Options>({ event: Events.ContextMenuCommandSuccess })
export class ContextMenuCommandSuccessListener extends Listener<
	typeof Events.ContextMenuCommandSuccess
> {
	public override run(payload: ContextMenuCommandSuccessPayload) {
		logSuccessCommand(payload);
	}

	public override onLoad() {
		this.enabled = isDebugLogging();

		return super.onLoad();
	}
}
