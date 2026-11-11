import { definePlatform } from '@unbound-app/api/native';

/** The source path of Discord's profile effect layer, which differs by platform. */
export const PROFILE_EFFECT_LAYER_PATH = definePlatform({
	ios: 'modules/collectibles/profile_effects/native/ProfileEffectLayer.ios.tsx',
	android: 'modules/collectibles/profile_effects/native/ProfileEffectLayer.android.tsx',
});
