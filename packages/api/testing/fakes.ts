export { createFakeSettings, defineSettings, setting, type FakeSettings } from './fake-settings';
// The fakes the preset is built from, for testing shared code that runs inside plugins but is no plugin itself.
export { installAddonGlobals, type InstalledAddonGlobals } from './install-addon-globals';
export { createFakeJava, type FakeJava, type JavaPlain } from './fake-java';
export { createMemoryStorage, type MemoryStorage } from './memory-storage';
export { brand, settled, withMissingMembers } from './fake-native-bridge';
export { createFakeNative, type FakeNative } from './fake-native';
export { createRecordingPatcher } from './recording-patcher';
