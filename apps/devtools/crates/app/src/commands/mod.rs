//! The `ubd` CLI as pages: one per command, built from what `ubd catalog` describes.

pub mod failure;
pub mod form;
pub mod nav;
pub mod page;
pub mod transcript;

pub use page::{CommandPage, bind_keys};
