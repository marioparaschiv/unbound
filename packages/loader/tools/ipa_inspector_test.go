package main

import (
	"archive/tar"
	"archive/zip"
	"bytes"
	"compress/gzip"
	"encoding/binary"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

const (
	machoExecute = 2
	machoDylib   = 6
)

// machO builds a minimal arm64 Mach-O whose only load commands are LC_LOAD_DYLIB for each name.
func machO(fileType uint32, loads ...string) []byte {
	var commands bytes.Buffer
	for _, name := range loads {
		size := (24 + len(name) + 1 + 7) &^ 7
		for _, value := range []uint32{0xc, uint32(size), 24, 0, 0x10000, 0x10000} {
			binary.Write(&commands, binary.LittleEndian, value)
		}
		commands.WriteString(name)
		commands.Write(make([]byte, size-24-len(name)))
	}
	var file bytes.Buffer
	for _, value := range []uint32{0xfeedfacf, 0x0100000c, 0, fileType, uint32(len(loads)), uint32(commands.Len()), 0, 0} {
		binary.Write(&file, binary.LittleEndian, value)
	}
	file.Write(commands.Bytes())
	return file.Bytes()
}

const executableInfoPlist = `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0"><dict><key>CFBundleExecutable</key><string>Discord</string></dict></plist>`

func writeZip(t *testing.T, path string, entries map[string][]byte) {
	t.Helper()
	output, err := os.Create(path)
	if err != nil {
		t.Fatal(err)
	}
	writer := zip.NewWriter(output)
	for name, data := range entries {
		header := &zip.FileHeader{Name: name, Method: zip.Deflate}
		header.SetMode(0o644)
		entry, err := writer.CreateHeader(header)
		if err != nil {
			t.Fatal(err)
		}
		entry.Write(data)
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	output.Close()
}

func injectedIPA(t *testing.T, executableLoads ...string) string {
	t.Helper()
	ipa := filepath.Join(t.TempDir(), "Discord.ipa")
	writeZip(t, ipa, map[string][]byte{
		"Payload/Discord.app/Info.plist":               []byte(executableInfoPlist),
		"Payload/Discord.app/Discord":                  machO(machoExecute, append([]string{"@rpath/Unbound.dylib"}, executableLoads...)...),
		"Payload/Discord.app/Frameworks/Unbound.dylib": machO(machoDylib, "/usr/lib/libobjc.A.dylib"),
	})
	return ipa
}

func writeInspector(t *testing.T, data []byte) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "UnboundInspector")
	if err := os.WriteFile(path, data, 0o755); err != nil {
		t.Fatal(err)
	}
	return path
}

func TestAddInspectorToIPAAddsAnUnloadedFramework(t *testing.T) {
	ipa := injectedIPA(t)
	library := machO(machoDylib, "/usr/lib/libobjc.A.dylib")
	if err := addInspectorToIPA(ipa, writeInspector(t, library)); err != nil {
		t.Fatal(err)
	}
	if err := validateIPAInspector(ipa); err != nil {
		t.Fatal(err)
	}
	reader, err := zip.OpenReader(ipa)
	if err != nil {
		t.Fatal(err)
	}
	defer reader.Close()
	names := map[string]*zip.File{}
	for _, file := range reader.File {
		names[file.Name] = file
	}
	entry := names["Payload/Discord.app/Frameworks/UnboundInspector.dylib"]
	if entry == nil {
		t.Fatalf("the IPA has no inspector; entries: %v", names)
	}
	if entry.Mode().Perm() != 0o755 {
		t.Fatalf("inspector mode = %v, want 0755", entry.Mode().Perm())
	}
	opened, _ := entry.Open()
	data, _ := io.ReadAll(opened)
	opened.Close()
	if !bytes.Equal(data, library) {
		t.Fatal("the inspector entry differs from the library")
	}
	if len(names) != 4 || names["Payload/Discord.app/Frameworks/Unbound.dylib"] == nil {
		t.Fatalf("the other entries changed: %v", names)
	}
}

func TestAddInspectorToIPAReplacesAnEarlierCopy(t *testing.T) {
	ipa := injectedIPA(t)
	if err := addInspectorToIPA(ipa, writeInspector(t, machO(machoDylib))); err != nil {
		t.Fatal(err)
	}
	if err := addInspectorToIPA(ipa, writeInspector(t, machO(machoDylib))); err != nil {
		t.Fatal(err)
	}
	reader, err := zip.OpenReader(ipa)
	if err != nil {
		t.Fatal(err)
	}
	defer reader.Close()
	if len(reader.File) != 4 {
		t.Fatalf("the IPA has %d entries, want 4", len(reader.File))
	}
}

func TestValidateIPAInspectorRejectsLoadedOrMissingInspectors(t *testing.T) {
	for _, test := range []struct {
		name      string
		loads     []string
		inspector []byte
		want      string
	}{
		{name: "missing", want: "has no Frameworks/UnboundInspector.dylib"},
		{name: "not a dylib", inspector: []byte("not mach-o"), want: "is not a Mach-O dylib"},
		{name: "an executable", inspector: machO(machoExecute), want: "is not a Mach-O dylib"},
		{name: "loaded", loads: []string{"@rpath/UnboundInspector.dylib"}, inspector: machO(machoDylib), want: "Discord has a load command for UnboundInspector"},
	} {
		t.Run(test.name, func(t *testing.T) {
			ipa := injectedIPA(t, test.loads...)
			if test.inspector != nil {
				if err := addInspectorToIPA(ipa, writeInspector(t, test.inspector)); err != nil {
					t.Fatal(err)
				}
			}
			err := validateIPAInspector(ipa)
			if err == nil || !strings.Contains(err.Error(), test.want) {
				t.Fatalf("validateIPAInspector() = %v, want %q", err, test.want)
			}
		})
	}
}

func TestValidateAppInspectorChecksTheSimulatorBundle(t *testing.T) {
	app := filepath.Join(t.TempDir(), "Discord.app")
	files := map[string][]byte{
		"Info.plist":                        []byte(executableInfoPlist),
		"Discord":                           machO(machoExecute, "@rpath/Unbound.dylib"),
		"Frameworks/Unbound.dylib":          machO(machoDylib),
		"Frameworks/UnboundInspector.dylib": machO(machoDylib),
	}
	for name, data := range files {
		path := filepath.Join(app, filepath.FromSlash(name))
		os.MkdirAll(filepath.Dir(path), 0o755)
		if err := os.WriteFile(path, data, 0o755); err != nil {
			t.Fatal(err)
		}
	}
	if err := validateAppInspector(app); err != nil {
		t.Fatal(err)
	}
	os.WriteFile(filepath.Join(app, "Frameworks", "Unbound.dylib"), machO(machoDylib, "@loader_path/UnboundInspector.dylib"), 0o755)
	if err := validateAppInspector(app); err == nil || !strings.Contains(err.Error(), "Frameworks/Unbound.dylib has a load command") {
		t.Fatalf("validateAppInspector() = %v, want a load command error", err)
	}
	os.Remove(filepath.Join(app, "Frameworks", "UnboundInspector.dylib"))
	if err := validateAppInspector(app); err == nil || !strings.Contains(err.Error(), "simulator app: app has no") {
		t.Fatalf("validateAppInspector() = %v, want a missing inspector error", err)
	}
}

// writeDeb builds a .deb whose gzip data tarball holds files, like Theos's rootless packages.
func writeDeb(t *testing.T, files map[string][]byte) string {
	t.Helper()
	var data bytes.Buffer
	compressed := gzip.NewWriter(&data)
	archive := tar.NewWriter(compressed)
	for name, contents := range files {
		archive.WriteHeader(&tar.Header{Name: name, Mode: 0o755, Size: int64(len(contents)), Typeflag: tar.TypeReg})
		archive.Write(contents)
	}
	archive.Close()
	compressed.Close()
	var deb bytes.Buffer
	deb.WriteString("!<arch>\n")
	for _, member := range []struct {
		name string
		data []byte
	}{
		{"debian-binary", []byte("2.0\n")},
		{"control.tar.gz", []byte("odd")},
		{"data.tar.gz", data.Bytes()},
	} {
		fmt.Fprintf(&deb, "%-16s%-12s%-6s%-6s%-8s%-10d`\n", member.name, "0", "0", "0", "100644", len(member.data))
		deb.Write(member.data)
		if len(member.data)%2 == 1 {
			deb.WriteString("\n")
		}
	}
	path := filepath.Join(t.TempDir(), "app.unbound.ios_1.0.0_iphoneos-arm64.deb")
	if err := os.WriteFile(path, deb.Bytes(), 0o644); err != nil {
		t.Fatal(err)
	}
	return path
}

func TestDebInspectorExtractsTheRootlessLibrary(t *testing.T) {
	library := machO(machoDylib)
	deb := writeDeb(t, map[string][]byte{
		"./var/jb/Library/MobileSubstrate/DynamicLibraries/Unbound.dylib": machO(machoDylib),
		"./var/jb/Library/Application Support/Unbound/UnboundInspector":   library,
	})
	path, err := debInspector(deb, t.TempDir(), defaultRunner, t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(path)
	if err != nil || !bytes.Equal(data, library) {
		t.Fatalf("debInspector() read %d bytes (%v), want the library", len(data), err)
	}
}

func TestDebInspectorRejectsAPackageWithoutIt(t *testing.T) {
	deb := writeDeb(t, map[string][]byte{"./var/jb/Library/MobileSubstrate/DynamicLibraries/Unbound.dylib": machO(machoDylib)})
	if _, err := debInspector(deb, t.TempDir(), defaultRunner, t.TempDir()); err == nil || !strings.Contains(err.Error(), "has no /Library/Application Support/Unbound/UnboundInspector") {
		t.Fatalf("debInspector() = %v, want a missing inspector error", err)
	}
	if _, _, err := arMember(writeInspector(t, []byte("plain")), "data.tar"); err == nil {
		t.Fatal("arMember accepted a file that is not an ar archive")
	}
}
