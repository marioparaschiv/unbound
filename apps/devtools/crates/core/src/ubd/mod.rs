//! Drives the `ubd` CLI for the GUI: what commands it has (`ubd catalog`), the argv a form's values
//! make, and a child process that streams the command's output.

pub mod argv;
pub mod catalog;
pub mod failure;
pub mod process;

pub use argv::{ArgError, FieldValue, Launcher, arguments, list_items};
pub use catalog::{Catalog, CatalogError, CommandSpec, Field, FieldKind};
pub use failure::{CommandError, ErrorCode};
pub use process::{JSON_FLAG, LoadError, Run, RunEvent, Stream, load_catalog, spawn};
