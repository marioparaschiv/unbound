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

pub fn decode(raw: &[i64]) -> Result<OperationsBatch, DecodeError> {
	todo!()
}
