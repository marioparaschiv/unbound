package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"testing"
)

func TestDecodeBinaryPlistMatchesXML(t *testing.T) {
	if runtime.GOOS != "darwin" {
		t.Skip("plutil writes the binary fixture")
	}

	directory := t.TempDir()
	path := filepath.Join(directory, "Info.plist")

	xml := plistHeader + `<plist version="1.0"><dict>
<key>CFBundleExecutable</key><string>Discord</string>
<key>NSCameraUsageDescription</key><string>Camera ✓ for video</string>
<key>UIRequiredDeviceCapabilities</key><array><string>arm64</string></array>
<key>LSRequiresIPhoneOS</key><true/>
<key>Count</key><integer>300</integer>
</dict></plist>`
	if err := os.WriteFile(path, []byte(xml), 0o644); err != nil {
		t.Fatal(err)
	}

	if output, err := exec.Command("plutil", "-convert", "binary1", path).CombinedOutput(); err != nil {
		t.Fatalf("plutil: %v %s", err, output)
	}

	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}

	node, err := decodeBinaryPlist(data)
	if err != nil {
		t.Fatal(err)
	}

	if node.get("CFBundleExecutable").text != "Discord" || node.get("NSCameraUsageDescription").text != "Camera ✓ for video" {
		t.Fatalf("strings decoded wrong: %+v", node)
	}

	if node.get("UIRequiredDeviceCapabilities").values[0].text != "arm64" || node.get("LSRequiresIPhoneOS").kind != plistTrueKind || node.get("Count").text != "300" {
		t.Fatalf("values decoded wrong: %+v", node)
	}
}

func TestDecodeBinaryPlistRejectsTruncatedData(t *testing.T) {
	if _, err := decodeBinaryPlist([]byte("bplist00")); err == nil {
		t.Fatal("expected an error")
	}
}
