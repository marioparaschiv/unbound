//! Edits to an element on device, as React DevTools makes them: set, delete and rename a value
//! inside props, state, hooks or context, and force a Suspense fallback or an error boundary.
//! The device re-renders; inspect the element again to see the result.

use serde_json::Value as Json;

use crate::inspect::Section;
use crate::react_protocol::{OverrideTarget, ReactOutbound};
use crate::session::{Devtools, RequestError};
use crate::store::ElementId;
use crate::value::{Path, PathSegment};

impl Devtools {
	/// Sets the value at `path` in a section; `None` sets `undefined`. A missing key is added.
	/// For hooks, `path` starts with the hook id.
	pub async fn override_value(
		&self,
		id: ElementId,
		section: Section,
		path: Path,
		value: Option<Json>,
	) -> Result<(), RequestError> {
		let renderer = self.renderer_of(id)?;
		check_hook_path(section, &path)?;

		self.send_edit(
			id,
			&ReactOutbound::OverrideValueAtPath {
				target: target(section),
				id,
				renderer,
				path,
				value,
			},
		)
	}

	/// Removes the key or array item at `path`. For hooks, `path` starts with the hook id.
	pub async fn delete_path(
		&self,
		id: ElementId,
		section: Section,
		path: Path,
	) -> Result<(), RequestError> {
		let renderer = self.renderer_of(id)?;
		check_hook_path(section, &path)?;

		self.send_edit(
			id,
			&ReactOutbound::DeletePath {
				target: target(section),
				id,
				renderer,
				path,
			},
		)
	}

	/// Moves the value at `old_path` to `new_path`. For hooks, both start with the same hook id.
	pub async fn rename_path(
		&self,
		id: ElementId,
		section: Section,
		old_path: Path,
		new_path: Path,
	) -> Result<(), RequestError> {
		let renderer = self.renderer_of(id)?;
		check_hook_path(section, &old_path)?;

		if section == Section::Hooks && old_path.first() != new_path.first() {
			return Err(RequestError::Invalid(
				"a hook rename keeps the hook id: both paths start with the same id".to_owned(),
			));
		}

		self.send_edit(
			id,
			&ReactOutbound::RenamePath {
				target: target(section),
				id,
				renderer,
				old_path,
				new_path,
			},
		)
	}

	/// Shows a Suspense boundary's fallback (`true`) or its children again (`false`).
	pub async fn override_suspense(
		&self,
		id: ElementId,
		force_fallback: bool,
	) -> Result<(), RequestError> {
		let renderer = self.renderer_of(id)?;

		self.send_edit(
			id,
			&ReactOutbound::OverrideSuspense {
				id,
				renderer,
				force_fallback,
			},
		)
	}

	/// Puts an error boundary into its errored state (`true`) or clears it (`false`).
	pub async fn override_error(
		&self,
		id: ElementId,
		force_error: bool,
	) -> Result<(), RequestError> {
		let renderer = self.renderer_of(id)?;

		self.send_edit(
			id,
			&ReactOutbound::OverrideError {
				id,
				renderer,
				force_error,
			},
		)
	}

	/// Sends an edit and drops the cached inspection, so the next inspect asks for full data.
	fn send_edit(&self, id: ElementId, message: &ReactOutbound) -> Result<(), RequestError> {
		if !self.inner.send(message) {
			return Err(RequestError::NotConnected);
		}

		self.inner.inspections.lock().remove(&id);
		Ok(())
	}
}

fn target(section: Section) -> OverrideTarget {
	match section {
		Section::Props => OverrideTarget::Props,
		Section::State => OverrideTarget::State,
		Section::Hooks => OverrideTarget::Hooks,
		Section::Context => OverrideTarget::Context,
	}
}

fn check_hook_path(section: Section, path: &[PathSegment]) -> Result<(), RequestError> {
	if section == Section::Hooks && !matches!(path.first(), Some(PathSegment::Index(_))) {
		return Err(RequestError::Invalid(
			"a hook edit's path starts with the hook id, e.g. [0] for the first useState"
				.to_owned(),
		));
	}

	Ok(())
}
