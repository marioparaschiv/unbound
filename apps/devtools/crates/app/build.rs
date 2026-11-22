//! Embeds the Windows icon (`assets/windows/app.rc`), which Explorer shows on the executable and
//! gpui loads for its windows.

fn main() {
	println!("cargo:rerun-if-changed=build.rs");
	if std::env::var("CARGO_CFG_TARGET_OS").as_deref() != Ok("windows") {
		return;
	}
	let rc = "../../assets/windows/app.rc";
	println!("cargo:rerun-if-changed={rc}");
	println!("cargo:rerun-if-changed=../../assets/windows/app.ico");
	embed_resource::compile(rc, embed_resource::NONE)
		.manifest_optional()
		.unwrap();
}
