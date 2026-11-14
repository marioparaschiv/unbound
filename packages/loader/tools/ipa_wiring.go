package main

import (
	"archive/zip"
	"bytes"
	"debug/macho"
	"fmt"
	"slices"
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

func plistValueOf(entries map[string]*zip.File, infoPath, key string) (string, error) {
	file := entries[infoPath]
	if file == nil {
		return "", fmt.Errorf("final IPA has no %s", infoPath)
	}
	data, err := readZipEntry(file)
	if err != nil {
		return "", err
	}
	return plistValue(data, key)
}

func bundleIdentifier(entries map[string]*zip.File, infoPath string) (string, error) {
	return plistValueOf(entries, infoPath, "CFBundleIdentifier")
}

func appGroupsOf(entries map[string]*zip.File, executable string) ([]string, error) {
	file := entries[executable]
	if file == nil {
		return nil, nil
	}
	data, err := readZipEntry(file)
	if err != nil {
		return nil, err
	}
	return machoAppGroups(data), nil
}

func missingAppGroup(extension, app []string) string {
	for _, group := range extension {
		if !slices.Contains(app, group) {
			return group
		}
	}
	return ""
}

func loadsGroupRemap(data []byte) bool {
	file, err := macho.NewFile(bytes.NewReader(data))
	if err != nil {
		return false
	}
	return machoLoadsDylib(file, groupRemapInstall)
}

// validateIPAExtensionWiring checks every extension lives under the app's bundle id, that Discord's own extensions
// load UnboundGroups.dylib, without which they cannot reach a sideloader's renamed app group, and that they ask only
// for app groups the app also has, since sideloaders rename and register the groups of each signed binary.
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
	appExecutable, err := plistValueOf(entries, app+"Info.plist", "CFBundleExecutable")
	if err != nil {
		return err
	}
	appGroups, err := appGroupsOf(entries, app+appExecutable)
	if err != nil {
		return err
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
		if group := missingAppGroup(machoAppGroups(data), appGroups); group != "" {
			return fmt.Errorf("%s uses app group %s, which the app does not, so a sideloader cannot share it", parts[0], group)
		}
	}
	return nil
}
