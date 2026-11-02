import { writeFile } from 'node:fs/promises';
import Logger from '@unbound-app/logger';

import { validatorRegistry } from './registry';
import { generateModule } from './generate';
import { GENERATED_PATH } from './paths';

const logger = Logger.create('Build', 'Validators');

const source = await generateModule(validatorRegistry);

await writeFile(GENERATED_PATH, source);

logger.info(
	`Wrote ${validatorRegistry.length} checks to ${GENERATED_PATH.replace(process.cwd() + '/', '')}.`,
);
