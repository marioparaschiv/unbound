/// <reference types="@unbound-app/api/global" />

import { getNativeModule, reload, BundleInfo } from '@unbound-app/api/native';
import { findByName, findByProps, findStore } from '@unbound-app/api/metro';
import { byProps, byName } from '@unbound-app/api/metro/filters';
import { getStore, get, set } from '@unbound-app/api/storage';
import type { DesignModule } from '@unbound-app/api/global';
import { showToast } from '@unbound-app/api/toasts';

const SomeComponent = findByName('SomeComponent');
const props = findByProps('someProp', 'anotherProp');
const userStore = findStore('UserStore');

const propsFilter = byProps('a', 'b');
const nameFilter = byName('C');

const store = getStore('unbound');
const enabled = get('unbound', 'plugins.enabled', false);
set('unbound', 'plugins.enabled', true);

const handle = showToast({
	title: 'Plugin SDK Test',
	content: 'Resolved end to end.',
	duration: 3000,
});

handle.close();

const native = getNativeModule('SomeNativeModule');
const version = BundleInfo.Version;

unbound.metro.findByProps('createStyles', 'dismissAlerts');

declare const design: DesignModule;
type CreateStylesFn = DesignModule['createStyles'];

if ($$DEV$$) {
	void reload();
	store.get('debug', false);

	const styles: CreateStylesFn = design.createStyles;

	void native;
	void SomeComponent;
	void props;
	void userStore;
	void propsFilter;
	void nameFilter;
	void enabled;
	void version;
	void styles;
}
