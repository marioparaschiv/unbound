package main

import (
	"archive/zip"
	"bytes"
	"debug/macho"
	"fmt"
	"strings"
)

func plistValue(data []byte, key string) (string, error) {
	info, err := readPlist(data)
	if err != nil {
		return "", err
	}
	if value := info.get(key); value != nil {
		return strings.TrimSpace(value.text), nil
	}
	return "", nil
}

func bundleIdentifier(entries map[string]*zip.File, infoPath string) (string, error) {
	file := entries[infoPath]
	if file == nil {
		return "", fmt.Errorf("final IPA has no %s", infoPath)
	}
	data, err := readZipEntry(file)
	if err != nil {
		return "", err
	}
	return plistValue(data, "CFBundleIdentifier")
}

func loadsGroupRemap(data []byte) bool {
	file, err := macho.NewFile(bytes.NewReader(data))
	if err != nil {
		return false
	}
	return machoLoadsDylib(file, groupRemapInstall)
}

// validateIPAExtensionWiring checks every extension lives under the app's bundle id, and that Discord's own extensions
// load UnboundGroups.dylib, without which they cannot reach a sideloader's renamed app group.
func validateIPAExtensionWiring(path string) error {
	archive, err := zip.OpenReader(path)
	if err != nil {
		return err
	}
	defer archive.Close()
	entries := make(map[string]*zip.File, len(archive.File))
	for _, file := range archive.File {
		entries[file.Name] = file
	}
	app, err := ipaAppDirectory(archive.File)
	if err != nil {
		return err
	}
	appID, err := bundleIdentifier(entries, app+"Info.plist")
	if err != nil || appID == "" {
		return fmt.Errorf("could not read the app's bundle identifier: %v", err)
	}
	if entries[app+groupRemapFramework] == nil {
		return fmt.Errorf("final IPA has no %s", groupRemapFramework)
	}
	for _, file := range archive.File {
		rest, ok := strings.CutPrefix(file.Name, app+"PlugIns/")
		parts := strings.Split(rest, "/")
		if !ok || len(parts) != 2 || parts[1] != "Info.plist" || !strings.HasSuffix(parts[0], ".appex") {
			continue
		}
		id, err := bundleIdentifier(entries, file.Name)
		if err != nil {
			return err
		}
		if !strings.HasPrefix(id, appID+".") {
			return fmt.Errorf("%s has bundle identifier %q, which iOS ignores outside %s", parts[0], id, appID)
		}
		executable := app + "PlugIns/" + parts[0] + "/" + strings.TrimSuffix(parts[0], ".appex")
		if !stockExtensionExecutable(executable, app) || entries[executable] == nil {
			continue
		}
		data, err := readZipEntry(entries[executable])
		if err != nil {
			return err
		}
		if !loadsGroupRemap(data) {
			return fmt.Errorf("%s does not load UnboundGroups.dylib, so it cannot reach a renamed app group", parts[0])
		}
	}
	return nil
}
