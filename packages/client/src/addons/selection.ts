import {
	consentKey,
	needsConsent,
	NativeConsentRequiredError,
	promptForConsent,
} from '~/native/consent';
import type { Addon, AddonResolveable } from '~/addons/addon';
import type { NativeConsents } from '~/native/consent';
import { AddonLifecycle } from '~/addons/lifecycle';
import { createRecord } from '~/addons/records';

/**
 * @description Which addons the user has on, on top of {@link AddonLifecycle}: enable, disable and
 * toggle, consent, and the selection policy. Most kinds turn each addon on by itself; a single-select
 * kind (themes, icon packs) applies one at a time and puts it on screen through {@link apply}.
 * @template I What the bundles of the addons this manager governs evaluate to.
 */
export abstract class AddonSelection<I extends object> extends AddonLifecycle<I> {
	/** Whether the user has each addon enabled, for kinds that turn addons on one by one. */
	protected readonly states = createRecord<boolean>(this.settings, 'states', (change) =>
		this.emit('record-changed', change),
	);
	/** The consent-gated capabilities the user allowed each addon, as {@link consentKey} names them. */
	protected readonly consents = createRecord<string>(this.settings, 'consents', (change) =>
		this.emit('record-changed', change),
	);
	/** `many`: each addon is on or off in `states`. `one`: the user applies a single addon, kept in `applied`. */
	protected readonly selection: 'many' | 'one' = 'many';
	/** For `one`: the addon applied while the user has applied no other, such as the default icon pack. */
	protected readonly fallback: string | null = null;

	/**
	 * @description Enables an addon, persisting its state and starting it if not already running, and emits
	 * `enabled`. A single-select kind first stops the addon it replaces. Twin of {@link disable}.
	 * @param entity The addon to enable, as its id or the entity itself.
	 * @returns Settles once the addon is on, or the user refused its consent.
	 */
	enable(entity: AddonResolveable<I>): void | Promise<void> {
		const resolved = this.resolve(entity);

		if (!resolved) return;

		if (needsConsent(resolved.manifest, this.getConsents())) {
			return this.requestConsent(resolved).then((granted) =>
				granted ? this.enableNow(resolved, true) : undefined,
			);
		}

		return this.enableNow(resolved, false);
	}

	private enableNow(resolved: Addon<I>, consented: boolean): void | Promise<void> {
		try {
			this.select(resolved, true);

			const activating = this.activate(resolved, consented);

			if (activating instanceof Promise) {
				return activating.then(() => void this.emit('enabled', resolved));
			}

			this.emit('enabled', resolved);
		} catch (error) {
			this.fail('enable', resolved.id, error);
		}
	}

	/**
	 * @description Disables an addon, persisting its state, taking it off screen when it was applied and
	 * stopping it if currently running, and emits `disabled`. Twin of {@link enable}.
	 * @param entity The addon to disable, as its id or the entity itself.
	 */
	disable(entity: AddonResolveable<I>): void {
		const resolved = this.resolve(entity);

		if (!resolved) return;

		try {
			this.pendingStarts.delete(resolved.id);

			const applied = this.selection === 'one' && this.isEnabled(resolved.id);

			this.select(resolved, false);

			if (applied) {
				this.unapply(resolved);
			}

			if (resolved.started) {
				this.stop(resolved);
			}

			this.emit('disabled', resolved);
		} catch (error) {
			this.fail('disable', resolved.id, error);
		}
	}

	/**
	 * @description Toggles an addon between enabled and disabled based on its current state, and emits `toggled`.
	 * @param entity The addon to toggle, as its id or the entity itself.
	 */
	toggle(entity: AddonResolveable<I>) {
		const resolved = this.resolve(entity);

		if (!resolved) return;

		if (this.isEnabled(resolved.id)) {
			this.disable(resolved);
		} else {
			this.enable(resolved);
		}

		this.emit('toggled', resolved);
	}

	/**
	 * @description Whether the user has an addon on: enabled, or for a single-select kind, applied.
	 * @param id The addon's id.
	 * @returns Its persisted state.
	 */
	isEnabled(id: string): boolean {
		return this.selection === 'one' ? this.getAppliedId() === id : Boolean(this.states.get(id));
	}

	/**
	 * @description Reads which addon a single-select kind has applied.
	 * @returns The applied addon's id, or `null` when none is.
	 */
	getAppliedId(): string | null {
		return this.settings.get<string | null>('applied', this.fallback);
	}

	/**
	 * @description Starts an addon the user has on; a single-select kind then puts it on screen through {@link apply}.
	 * @param entity The addon.
	 * @param consented Whether the user just allowed its consent-gated capabilities.
	 * @returns Settles once it is on screen; a failure to apply is recorded, not thrown.
	 */
	protected activate(entity: Addon<I>, consented = false): void | Promise<void> {
		if (!entity.started) {
			this.start(entity, consented);
		}

		if (this.selection === 'many') return;

		try {
			const applying = this.apply(entity);

			if (applying instanceof Promise) {
				return applying.catch((error) => void this.fail('apply', entity.id, error));
			}
		} catch (error) {
			this.fail('apply', entity.id, error);
		}
	}

	/**
	 * @description For a single-select kind: puts the applied addon on screen once it runs, replacing the one before. Twin of {@link unapply}.
	 * @param _entity The applied addon.
	 * @returns Settles once it is on screen.
	 */
	protected apply(_entity: Addon<I>): void | Promise<void> {
		// Kinds the user turns on one by one have nothing to put on screen.
	}

	/**
	 * @description For a single-select kind: takes the applied addon off screen when the user turns it off. Twin of {@link apply}.
	 * @param _entity The addon turned off.
	 */
	protected unapply(_entity: Addon<I>): void {
		// Kinds the user turns on one by one have nothing to take off screen.
	}

	/**
	 * @description Records whether the user has an addon on. A single-select kind stops the addon it
	 * replaces first, while that one still reads as applied, so nothing leaves the screen in between.
	 * @param resolved The addon.
	 * @param enabled Whether it is now on.
	 */
	protected select(resolved: Addon<I>, enabled: boolean): void {
		if (this.selection === 'many') {
			this.states.set(resolved.id, enabled);

			return;
		}

		const applied = this.getAppliedId();

		if (!enabled) {
			if (applied === resolved.id) {
				this.setApplied(this.fallback, resolved.id);
			}

			return;
		}

		const replaced = applied === null ? undefined : this.getEntity(applied);

		if (replaced !== resolved && replaced?.started) {
			this.stop(replaced);
		}

		this.setApplied(resolved.id, resolved.id);
	}

	private setApplied(applied: string | null, id: string): void {
		this.settings.set('applied', applied);
		this.emit('record-changed', { key: 'applied', id });
	}

	/**
	 * @description Reads the consents the user gave for consent-gated capabilities.
	 * @returns The consents keyed by addon id.
	 */
	protected getConsents(): NativeConsents {
		return this.consents.all();
	}

	/**
	 * @description Asks the user to allow an addon's consent-gated capabilities and records the answer.
	 * @param entity The addon asking.
	 * @returns Whether the user allowed it.
	 */
	protected async requestConsent(entity: Addon<I>): Promise<boolean> {
		const granted = await promptForConsent(entity).catch((error) => {
			this.logger.error(`Failed to ask for consent for ${entity.id}:`, error);

			return false;
		});

		if (!granted) {
			this.errors.set(entity.id, new NativeConsentRequiredError(entity.name));

			return false;
		}

		this.consents.set(entity.id, consentKey(entity.manifest));
		this.errors.delete(entity.id);

		return true;
	}
}
