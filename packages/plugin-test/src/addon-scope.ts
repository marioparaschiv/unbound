const greeting: string = addon.manifest.name;

logger.info(greeting);
logger.success(addon.id, addon.started);

const unpatch: () => void = patcher.after(console, 'log', (context) => context.result);

patcher.unpatchAll();
unpatch();

const removeCommands: () => void = commands.register({
	hello: { description: 'Says hello.', execute: () => ({ content: greeting }) },
});

commands.unregister('hello');
commands.unregisterAll();
removeCommands();

const timeout = setTimeout(() => logger.log('tick'), 1000);
const interval = setInterval(() => logger.debug('tock'), 1000);

clearTimeout(timeout);
clearInterval(interval);

const element = React.createElement('View');
const storage = unbound.storage.getBucket();

logger.warn(element, storage);

export {};
