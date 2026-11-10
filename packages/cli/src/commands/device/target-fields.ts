import { defaulted, Type } from '~/lib/schema';

/** The flags that pick the device a state command acts on, and whether it relaunches Discord. */
export const deviceTargetFields = {
	serial: Type.Optional(
		Type.String({
			description: 'The adb serial of the Android device, when several are attached.',
		}),
	),
	ios: defaulted(
		Type.Boolean({
			description: 'Act on a jailbroken iPhone through jb-p1lot instead of over adb.',
		}),
		false,
	),
	udid: Type.Optional(
		Type.String({
			description: 'The UDID of the iPhone, when several are connected. Implies --ios.',
		}),
	),
	restart: defaulted(Type.Boolean({ description: 'Relaunch Discord afterwards.' }), false),
};

export default deviceTargetFields;
