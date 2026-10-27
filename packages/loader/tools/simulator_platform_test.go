package main

import (
	"bytes"
	"encoding/binary"
	"io"
	"os"
	"path/filepath"
	"reflect"
	"testing"
)

func writeIPhoneOSDylib(t *testing.T, path string, command uint32) {
	t.Helper()
	var file bytes.Buffer
	for _, value := range []uint32{0xfeedfacf, 0x0100000c, 0, 6, 1, 16, 0, 0, command, 16, 0x000b0000, 0x00110000} {
		binary.Write(&file, binary.LittleEndian, value)
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, file.Bytes(), 0o755); err != nil {
		t.Fatal(err)
	}
}

func TestRetargetLegacyFrameworksConvertsIPhoneOSBinaries(t *testing.T) {
	app := filepath.Join(t.TempDir(), "Discord.app")
	legacy := filepath.Join(app, "Frameworks", "CydiaSubstrate.framework", "CydiaSubstrate")
	writeIPhoneOSDylib(t, legacy, loadCommandVersionMinIPhoneOS)
	writeIPhoneOSDylib(t, filepath.Join(app, "Frameworks", "Modern.framework", "Modern"), 0x32)
	if err := os.WriteFile(filepath.Join(app, "Frameworks", "CydiaSubstrate.framework", "Info.plist"), []byte("<plist/>"), 0o644); err != nil {
		t.Fatal(err)
	}
	var calls [][]string
	runner := func(root, name string, args []string, env []string, stdout, stderr io.Writer) error {
		calls = append(calls, append([]string{name}, args...))
		return nil
	}
	if err := retargetLegacyFrameworks(app, runner, t.TempDir()); err != nil {
		t.Fatal(err)
	}
	expected := [][]string{{"xcrun", "vtool", "-set-build-version", "7", "11.0", "17.0", "-replace", "-output", legacy, legacy}}
	if !reflect.DeepEqual(calls, expected) {
		t.Fatalf("only the iPhoneOS-only binary must be retargeted, ran %v", calls)
	}
}

func TestRetargetLegacyFrameworksAllowsAppsWithoutFrameworks(t *testing.T) {
	runner := func(string, string, []string, []string, io.Writer, io.Writer) error {
		t.Fatal("nothing must be retargeted")
		return nil
	}
	if err := retargetLegacyFrameworks(filepath.Join(t.TempDir(), "Discord.app"), runner, t.TempDir()); err != nil {
		t.Fatal(err)
	}
}

func TestMachoVersion(t *testing.T) {
	for encoded, expected := range map[uint32]string{0x000b0000: "11.0", 0x00110200: "17.2", 0x000e0301: "14.3.1"} {
		if got := machoVersion(encoded); got != expected {
			t.Errorf("machoVersion(%#x) = %q, want %q", encoded, got, expected)
		}
	}
}
