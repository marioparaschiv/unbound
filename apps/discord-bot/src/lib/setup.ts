import '@sapphire/plugin-subcommands/register';
import '@sapphire/plugin-i18next/register';
import '@sapphire/plugin-logger/register';

import { ApplicationCommandRegistries, RegisterBehavior } from '@sapphire/framework';
import { PaginatedMessage } from '@sapphire/discord.js-utilities';
import { ButtonStyle, ComponentType } from 'discord.js';

ApplicationCommandRegistries.setDefaultBehaviorWhenNotIdentical(RegisterBehavior.BulkOverwrite);

PaginatedMessage.defaultActions = [
	{
		customId: '@sapphire/paginated-messages.firstPage',
		style: ButtonStyle.Primary,
		label: '↞',
		type: ComponentType.Button,
		run: ({ handler }) => {
			handler.index = 0;
		},
	},
	{
		customId: '@sapphire/paginated-messages.previousPage',
		style: ButtonStyle.Primary,
		label: '←',
		type: ComponentType.Button,
		run: ({ handler }) => {
			handler.index = handler.index === 0 ? handler.pages.length - 1 : handler.index - 1;
		},
	},
	{
		customId: '@sapphire/paginated-messages.nextPage',
		style: ButtonStyle.Primary,
		label: '→',
		type: ComponentType.Button,
		run: ({ handler }) => {
			handler.index = handler.index === handler.pages.length - 1 ? 0 : handler.index + 1;
		},
	},
	{
		customId: '@sapphire/paginated-messages.goToLastPage',
		style: ButtonStyle.Primary,
		label: '↠',
		type: ComponentType.Button,
		run: ({ handler }) => {
			handler.index = handler.pages.length - 1;
		},
	},
	{
		customId: '@sapphire/paginated-messages.stop',
		style: ButtonStyle.Danger,
		label: 'x',
		type: ComponentType.Button,
		run: ({ collector }) => {
			collector.stop();
		},
	},
];
