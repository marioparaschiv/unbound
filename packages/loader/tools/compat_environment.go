package main

// Names that exist only where Discord runs, so the scan reports them as external instead of broken.
var compatEnvironmentClasses = map[string]string{
	"android.app.ActivityThread":                "a hidden Android platform class that the public SDK stubs leave out; it exists on every device, and the loader reads the current application from it and skips the hook when that fails",
	"android.app.ApplicationPackageManager":     "a hidden Android platform class that the public SDK stubs leave out; it is the `PackageManager` every device returns, and the loader skips the icon hook when hooking it fails",
	"LCAppInfo":                                 "LiveContainer's own class, present only when Discord runs inside LiveContainer, so its absence is expected",
	"LCSharedUtils":                             "LiveContainer's own class, present only when Discord runs inside LiveContainer, so its absence is expected",
	"UIPlaceholderColor":                        "a private UIKit class that the iOS SDK leaves out; it ships with iOS, not Discord, so a Discord update cannot remove it",
	"android.os.SystemProperties":               "a hidden Android platform class that the public SDK stubs leave out; it exists on every device, and the loader falls back to `Build` values when reading it fails",
	"org.lsposed.lspatch.loader.LSPApplication": "LSPatch's own class, present only when Discord was patched with LSPatch, so its absence is expected",
}

var compatEnvironmentFields = map[string]string{
	"mOuterRadii": "the private corner radii of Android's `android.graphics.drawable.shapes.RoundRectShape`, which the public SDK stubs leave out; it exists on every device, and the SDK has no getter for it",
	"mColor":      "the private color field of Android's `android.text.style.ForegroundColorSpan`, which the public SDK stubs leave out; it exists on every device, and the SDK has no setter for it",
}
