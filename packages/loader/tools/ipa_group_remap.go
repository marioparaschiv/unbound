package main

import (
	"archive/zip"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const (
	groupRemapFramework = "Frameworks/UnboundGroups.dylib"
	groupRemapInstall   = "@rpath/UnboundGroups.dylib"
)

var ownExtensions = map[string]bool{"OpenInDiscord.appex": true, "Share.appex": true}

func buildGroupRemap(options buildOptions, work string, runner commandRunner) (string, error) {
	source := filepath.Join(iosRoot(options.root), "groups", "UnboundGroups.m")
	output := filepath.Join(work, "UnboundGroups.dylib")
	args := []string{"-sdk", "iphoneos", "clang", "-dynamiclib", "-arch", "arm64", "-miphoneos-version-min=15.0", "-fobjc-arc", "-framework", "Foundation", "-install_name", groupRemapInstall, "-o", output, source}
	if err := runner(work, "xcrun", args, os.Environ(), os.Stdout, os.Stderr); err != nil {
		return "", fmt.Errorf("building UnboundGroups.dylib failed: %w", err)
	}
	return output, nil
}

func stockExtensionExecutable(name, app string) bool {
	rest, ok := strings.CutPrefix(name, app+"PlugIns/")
	if !ok {
		return false
	}
	parts := strings.Split(rest, "/")
	if len(parts) != 2 || !strings.HasSuffix(parts[0], ".appex") || ownExtensions[parts[0]] {
		return false
	}
	return parts[1] == strings.TrimSuffix(parts[0], ".appex")
}

func patchedExtension(file *zip.File, work string) ([]byte, error) {
	data, err := readZipEntry(file)
	if err != nil {
		return nil, err
	}
	binary := filepath.Join(work, "group-remap-"+filepath.Base(file.Name))
	if err := os.WriteFile(binary, data, 0o755); err != nil {
		return nil, err
	}
	defer os.Remove(binary)
	if err := addWeakDylib(binary, groupRemapInstall); err != nil {
		return nil, err
	}
	return os.ReadFile(binary)
}

// addGroupRemapToIPA puts UnboundGroups.dylib in the app's Frameworks and has Discord's own extensions load it, so
// they find the shared app group a sideloader renamed.
func addGroupRemapToIPA(ipa, library, work string) error {
	dylib, err := os.ReadFile(library)
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
	output, err := os.CreateTemp(filepath.Dir(ipa), ".groups-*.ipa")
	if err != nil {
		return err
	}
	defer os.Remove(output.Name())
	writer := zip.NewWriter(output)
	write := func(name string, data []byte) error {
		header := &zip.FileHeader{Name: name, Method: zip.Deflate, Modified: time.Now()}
		header.SetMode(0o755)
		entry, err := writer.CreateHeader(header)
		if err == nil {
			_, err = entry.Write(data)
		}
		return err
	}
	for _, file := range reader.File {
		if file.Name == app+groupRemapFramework {
			continue
		}
		if stockExtensionExecutable(file.Name, app) {
			data, err := patchedExtension(file, work)
			if err == nil {
				err = write(file.Name, data)
			}
			if err != nil {
				output.Close()
				return fmt.Errorf("adding UnboundGroups.dylib to %s: %w", file.Name, err)
			}
			continue
		}
		if err := writer.Copy(file); err != nil {
			output.Close()
			return err
		}
	}
	err = write(app+groupRemapFramework, dylib)
	if closeErr := errors.Join(writer.Close(), output.Close()); err == nil {
		err = closeErr
	}
	if err != nil {
		return err
	}
	return os.Rename(output.Name(), ipa)
}
