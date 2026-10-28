//! Decodes the backend's `operations` payload: `[rendererID, rootID, stringTableSize,
//! ...stringTable, ...ops]`, per react-devtools-core 8's `backend.js` and the frontend `store.js`.

use std::sync::Arc;

use crate::store::{ElementId, ElementKind, RendererId};

#[derive(Clone, Debug, PartialEq)]
pub struct OperationsBatch {
	pub renderer: RendererId,
	/// The root this batch is about; `-1` in v8 batches that span roots.
	pub root: ElementId,
	pub ops: Vec<TreeOp>,
}

#[derive(Clone, Debug, PartialEq)]
pub enum TreeOp {
	AddRoot {
		id: ElementId,
		strict_mode_compliant: bool,
		supports_profiling: bool,
		has_owner_metadata: bool,
	},
	Add {
		id: ElementId,
		kind: ElementKind,
		parent: ElementId,
		owner: Option<ElementId>,
		display_name: Option<Arc<str>>,
		key: Option<Arc<str>>,
	},
	Remove(Vec<ElementId>),
	/// v4 only: removes the batch's root.
	RemoveRoot,
	Reorder {
		id: ElementId,
		children: Vec<ElementId>,
	},
	ErrorsAndWarnings {
		id: ElementId,
		errors: u32,
		warnings: u32,
	},
	/// Ops the store does not model (base durations, subtree modes, the suspense tree, activity
	/// slices). Decoded only to stay aligned with the stream.
	Ignored(u8),
}

#[derive(Debug, thiserror::Error, PartialEq)]
pub enum DecodeError {
	#[error("operations truncated at index {0}")]
	Truncated(usize),
	#[error("unknown operation {op} at index {at}")]
	UnknownOp { op: i64, at: usize },
	#[error("string id {0} outside the string table")]
	BadString(i64),
}

const ADD: i64 = 1;
const REMOVE: i64 = 2;
const REORDER_CHILDREN: i64 = 3;
const UPDATE_TREE_BASE_DURATION: i64 = 4;
const UPDATE_ERRORS_OR_WARNINGS: i64 = 5;
const REMOVE_ROOT: i64 = 6;
const SET_SUBTREE_MODE: i64 = 7;
const SUSPENSE_ADD: i64 = 8;
const SUSPENSE_REMOVE: i64 = 9;
const SUSPENSE_REORDER_CHILDREN: i64 = 10;
const SUSPENSE_RESIZE: i64 = 11;
const SUSPENSE_SUSPENDERS: i64 = 12;
const APPLIED_ACTIVITY_SLICE_CHANGE: i64 = 13;

const ELEMENT_TYPE_ROOT: i64 = 11;
const PROFILING_FLAG_BASIC_SUPPORT: i64 = 1;

struct Cursor<'a> {
	raw: &'a [i64],
	at: usize,
}

impl Cursor<'_> {
	fn next(&mut self) -> Result<i64, DecodeError> {
		let value = *self
			.raw
			.get(self.at)
			.ok_or(DecodeError::Truncated(self.at))?;
		self.at += 1;
		Ok(value)
	}

	fn len(&mut self) -> Result<usize, DecodeError> {
		let at = self.at;
		usize::try_from(self.next()?).map_err(|_| DecodeError::Truncated(at))
	}

	fn count(&mut self) -> Result<u32, DecodeError> {
		Ok(self.next()?.clamp(0, i64::from(u32::MAX)) as u32)
	}

	fn skip(&mut self, n: usize) -> Result<(), DecodeError> {
		let end = self.at.checked_add(n).filter(|end| *end <= self.raw.len());
		self.at = end.ok_or(DecodeError::Truncated(self.raw.len()))?;
		Ok(())
	}

	fn ids(&mut self, n: usize) -> Result<Vec<ElementId>, DecodeError> {
		(0..n).map(|_| self.next().map(ElementId)).collect()
	}

	/// Suspense rects: a count (`-1` for none), then four values per rect.
	fn skip_rects(&mut self) -> Result<(), DecodeError> {
		let count = usize::try_from(self.next()?).unwrap_or(0);
		self.skip(count.saturating_mul(4))
	}
}

pub fn decode(raw: &[i64]) -> Result<OperationsBatch, DecodeError> {
	let mut cursor = Cursor { raw, at: 0 };
	let renderer = RendererId(cursor.next()?);
	let root = ElementId(cursor.next()?);
	let table_size = cursor.len()?;
	let table_end = cursor.at.saturating_add(table_size);
	let mut strings: Vec<Arc<str>> = Vec::new();

	while cursor.at < table_end {
		let len = cursor.len()?;
		let start = cursor.at;
		cursor.skip(len)?;
		strings.push(decode_string(&raw[start..cursor.at]));
	}

	let string = |id: i64| -> Result<Option<Arc<str>>, DecodeError> {
		if id == 0 {
			return Ok(None);
		}

		usize::try_from(id - 1)
			.ok()
			.and_then(|index| strings.get(index))
			.map(|s| Some(s.clone()))
			.ok_or(DecodeError::BadString(id))
	};

	let mut ops = Vec::new();

	while cursor.at < raw.len() {
		let at = cursor.at;
		let op = cursor.next()?;

		let decoded = match op {
			ADD => {
				let id = ElementId(cursor.next()?);
				let kind = cursor.next()?;

				if kind == ELEMENT_TYPE_ROOT {
					let strict_mode_compliant = cursor.next()? != 0;
					let profiling_flags = cursor.next()?;
					let _supports_strict_mode = cursor.next()?;
					let has_owner_metadata = cursor.next()? != 0;

					TreeOp::AddRoot {
						id,
						strict_mode_compliant,
						supports_profiling: profiling_flags & PROFILING_FLAG_BASIC_SUPPORT != 0,
						has_owner_metadata,
					}
				} else {
					let parent = ElementId(cursor.next()?);
					let owner = cursor.next()?;
					let display_name = string(cursor.next()?)?;
					let key = string(cursor.next()?)?;
					// The Suspense/Activity `name` prop; the tree shows the display name.
					string(cursor.next()?)?;

					TreeOp::Add {
						id,
						kind: ElementKind::from_wire(kind),
						parent,
						owner: (owner != 0).then_some(ElementId(owner)),
						display_name,
						key,
					}
				}
			}
			REMOVE => {
				let n = cursor.len()?;
				TreeOp::Remove(cursor.ids(n)?)
			}
			REORDER_CHILDREN => {
				let id = ElementId(cursor.next()?);
				let n = cursor.len()?;
				TreeOp::Reorder {
					id,
					children: cursor.ids(n)?,
				}
			}
			UPDATE_ERRORS_OR_WARNINGS => {
				let id = ElementId(cursor.next()?);
				let errors = cursor.count()?;
				let warnings = cursor.count()?;
				TreeOp::ErrorsAndWarnings {
					id,
					errors,
					warnings,
				}
			}
			REMOVE_ROOT => TreeOp::RemoveRoot,
			UPDATE_TREE_BASE_DURATION | SET_SUBTREE_MODE => {
				cursor.skip(2)?;
				TreeOp::Ignored(op as u8)
			}
			SUSPENSE_ADD => {
				// id, parent, name, isSuspended, rects.
				cursor.skip(4)?;
				cursor.skip_rects()?;
				TreeOp::Ignored(op as u8)
			}
			SUSPENSE_REMOVE => {
				let n = cursor.len()?;
				cursor.skip(n)?;
				TreeOp::Ignored(op as u8)
			}
			SUSPENSE_REORDER_CHILDREN => {
				cursor.skip(1)?;
				let n = cursor.len()?;
				cursor.skip(n)?;
				TreeOp::Ignored(op as u8)
			}
			SUSPENSE_RESIZE => {
				cursor.skip(1)?;
				cursor.skip_rects()?;
				TreeOp::Ignored(op as u8)
			}
			SUSPENSE_SUSPENDERS => {
				let changes = cursor.len()?;

				for _ in 0..changes {
					// id, hasUniqueSuspenders, endTime, isSuspended, then the environment names.
					cursor.skip(4)?;
					let environments = cursor.len()?;
					cursor.skip(environments)?;
				}

				TreeOp::Ignored(op as u8)
			}
			APPLIED_ACTIVITY_SLICE_CHANGE => {
				cursor.skip(1)?;
				TreeOp::Ignored(op as u8)
			}
			_ => return Err(DecodeError::UnknownOp { op, at }),
		};

		ops.push(decoded);
	}

	Ok(OperationsBatch {
		renderer,
		root,
		ops,
	})
}

/// The string table carries code points: the backend folds surrogate pairs before sending.
fn decode_string(codes: &[i64]) -> Arc<str> {
	codes
		.iter()
		.map(|code| {
			u32::try_from(*code)
				.ok()
				.and_then(char::from_u32)
				.unwrap_or('\u{fffd}')
		})
		.collect::<String>()
		.into()
}
