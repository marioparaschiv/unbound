import { ApplicationCommand } from '../discord/commands';


export type UnboundCommand = ApplicationCommand & {
	__UNBOUND__?: boolean;
	__CALLER__?: string;
};