package main

import (
	"archive/zip"
	"bytes"
	"debug/macho"
	"errors"
	"fmt"
	"io"
	"os"
	"path"
	"path/filepath"
	"strings"
	"time"
)

const (
	// Where the deb installs UnboundInspector, without `.dylib` so neither ElleKit nor cyan injects it.
	inspectorDebPath = "Library/Application Support/Unbound/UnboundInspector"
	// Its name in the IPA's Frameworks/, where sideload signers sign it and Unbound.dylib dlopens it.
	inspectorFramework = "Frameworks/UnboundInspector.dylib"
	inspectorName      = "UnboundInspector"
)

// debInspector extracts UnboundInspector from a tweak package's data tarball into work.
func debInspector(deb, work string, runner commandRunner, root string) (string, error) {
	name, data, err := arMember(deb, "data.tar")
	if err != nil {
		return "", fmt.Errorf("reading %s: %w", deb, err)
	}
	archive := filepath.Join(work, name)
	if err := os.WriteFile(archive, data, 0o644); err != nil {
		return "", err
	}
	extracted := filepath.Join(work, "deb-data")
	if err := os.MkdirAll(extracted, 0o755); err != nil {
		return "", err
	}
	if err := runner(root, "tar", []string{"-xf", archive, "-C", extracted}, os.Environ(), os.Stdout, os.Stderr); err != nil {
		return "", fmt.Errorf("extracting %s from %s: %w", name, deb, err)
	}
	for _, prefix := range []string{"var/jb", ""} {
		candidate := filepath.Join(extracted, prefix, filepath.FromSlash(inspectorDebPath))
		if info, err := os.Stat(candidate); err == nil && info.Mode().IsRegular() {
			return candidate, nil
		}
	}
	return "", fmt.Errorf("tweak package %s has no /%s", deb, inspectorDebPath)
}

// arMember reads the first member of a Unix ar archive, such as a .deb, whose name starts with prefix.
func arMember(path, prefix string) (string, []byte, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return "", nil, err
	}
	const magic = "!<arch>\n"
	if !bytes.HasPrefix(data, []byte(magic)) {
		return "", nil, errors.New("not an ar archive")
	}
	for offset := len(magic); offset+60 <= len(data); {
		header := data[offset : offset+60]
		name := strings.TrimSuffix(strings.TrimSpace(string(header[:16])), "/")
		var size int
		if _, err := fmt.Sscanf(strings.TrimSpace(string(header[48:58])), "%d", &size); err != nil || size < 0 {
			return "", nil, fmt.Errorf("ar member %q has an invalid size", name)
		}
		start := offset + 60
		if start+size > len(data) {
			return "", nil, fmt.Errorf("ar member %q is truncated", name)
		}
		if strings.HasPrefix(name, prefix) {
			return name, data[start : start+size], nil
		}
		offset = start + size + size%2
	}
	return "", nil, fmt.Errorf("no %s* member", prefix)
}

// ipaAppDirectory returns the `Payload/<App>.app/` prefix of an IPA's entries.
func ipaAppDirectory(files []*zip.File) (string, error) {
	for _, file := range files {
		parts := strings.Split(file.Name, "/")
		if len(parts) >= 3 && parts[0] == "Payload" && strings.HasSuffix(parts[1], ".app") {
			return "Payload/" + parts[1] + "/", nil
		}
	}
	return "", errors.New("IPA has no Payload/*.app")
}

// addInspectorToIPA writes the inspector into the IPA's Frameworks/, copying every other entry unchanged.
func addInspectorToIPA(ipa, inspector string) error {
	library, err := os.ReadFile(inspector)
	if err != nil {
		return err
	}
	reader, err := zip.OpenReader(ipa)
	if err != nil {
		return err
	}
	defer reader.Close()
	app, err := ipaAppDirectory(reader.File)
	if err != nil {
		return err
	}
	target := app + inspectorFramework
	output, err := os.CreateTemp(filepath.Dir(ipa), ".inspector-*.ipa")
	if err != nil {
		return err
	}
	defer os.Remove(output.Name())
	writer := zip.NewWriter(output)
	for _, file := range reader.File {
		if file.Name == target {
			continue
		}
		if err := writer.Copy(file); err != nil {
			output.Close()
			return err
		}
	}
	header := &zip.FileHeader{Name: target, Method: zip.Deflate, Modified: time.Now()}
	header.SetMode(0o755)
	entry, err := writer.CreateHeader(header)
	if err == nil {
		_, err = entry.Write(library)
	}
	if closeErr := errors.Join(writer.Close(), output.Close()); err == nil {
		err = closeErr
	}
	if err != nil {
		return err
	}
	return os.Rename(output.Name(), ipa)
}

// appFile reads one file of an app bundle by its path inside the bundle.
type appFile func(name string) ([]byte, error)

// validateInspector checks an app bundle carries the inspector as a Mach-O dylib and that neither the
// executable nor any Frameworks/*.dylib loads it, so it only ever loads through dlopen.
func validateInspector(read appFile, frameworks []string) error {
	library, err := read(inspectorFramework)
	if err != nil {
		return fmt.Errorf("app has no %s: %w", inspectorFramework, err)
	}
	image, err := openMachOSlice(library)
	if err != nil || image.Type != macho.TypeDylib {
		return fmt.Errorf("%s is not a Mach-O dylib", inspectorFramework)
	}
	plist, err := read("Info.plist")
	if err != nil {
		return err
	}
	info, err := readPlist(plist)
	if err != nil {
		return err
	}
	executable := info.get("CFBundleExecutable")
	if executable == nil || strings.TrimSpace(executable.text) == "" {
		return errors.New("app Info.plist has no CFBundleExecutable")
	}
	binaries := []string{strings.TrimSpace(executable.text)}
	for _, name := range frameworks {
		if path.Dir(name) == "Frameworks" && strings.HasSuffix(name, ".dylib") && name != inspectorFramework {
			binaries = append(binaries, name)
		}
	}
	for _, name := range binaries {
		data, err := read(name)
		if err != nil {
			return err
		}
		image, err := openMachOSlice(data)
		if err != nil {
			return fmt.Errorf("reading %s: %w", name, err)
		}
		for _, load := range image.Loads {
			if bytes.Contains(load.Raw(), []byte(inspectorName)) {
				return fmt.Errorf("%s has a load command for %s; it must load only through dlopen", name, inspectorName)
			}
		}
	}
	return nil
}

// validateIPAInspector runs validateInspector over a packed IPA.
func validateIPAInspector(ipa string) error {
	reader, err := zip.OpenReader(ipa)
	if err != nil {
		return err
	}
	defer reader.Close()
	app, err := ipaAppDirectory(reader.File)
	if err != nil {
		return err
	}
	entries := map[string]*zip.File{}
	names := []string{}
	for _, file := range reader.File {
		if name, ok := strings.CutPrefix(file.Name, app); ok {
			entries[name] = file
			names = append(names, name)
		}
	}
	read := func(name string) ([]byte, error) {
		file := entries[name]
		if file == nil {
			return nil, os.ErrNotExist
		}
		opened, err := file.Open()
		if err != nil {
			return nil, err
		}
		defer opened.Close()
		return io.ReadAll(opened)
	}
	if err := validateInspector(read, names); err != nil {
		return fmt.Errorf("final IPA: %w", err)
	}
	return nil
}

// validateAppInspector runs validateInspector over an unpacked app bundle.
func validateAppInspector(app string) error {
	frameworks, _ := filepath.Glob(filepath.Join(app, "Frameworks", "*.dylib"))
	names := make([]string, 0, len(frameworks))
	for _, framework := range frameworks {
		names = append(names, "Frameworks/"+filepath.Base(framework))
	}
	read := func(name string) ([]byte, error) {
		return os.ReadFile(filepath.Join(app, filepath.FromSlash(name)))
	}
	if err := validateInspector(read, names); err != nil {
		return fmt.Errorf("simulator app: %w", err)
	}
	return nil
}
