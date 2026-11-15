import { ApplyOptions } from '@sapphire/decorators';
import type { Command } from '@sapphire/framework';

import { CaseListCommand } from '~/moderation/case-list-command';
import { listCases } from '~/moderation/cases';
import { getDatabase } from '~/db/instance';

@ApplyOptions<Command.Options>({
	name: 'warnings',
	description: "Lists a user's warnings that are not pardoned, newest first.",
	aliases: ['warns'],
	requiredUserPermissions: ['ModerateMembers'],
	preconditions: ['unbound'],
})
export class WarningsCommand extends CaseListCommand {
	protected readonly noun = 'warnings';

	protected async list(userId: string) {
		const warnings = await listCases(getDatabase(), userId, 'warn');

		return warnings.filter((warning) => !warning.closedAt);
	}
}
