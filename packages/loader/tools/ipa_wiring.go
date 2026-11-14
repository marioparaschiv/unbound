package main

import (
	"archive/zip"
	"bytes"
	"fmt"
	"strings"
)

const shareAppGroup = "group.com.hammerandchisel.discord"

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

func validateIPAExtensionWiring(path string) error {
	archive, err := zip.OpenReader(path)
	if err != nil {
		return err
	}
	defer archive.Close()
	entries := make(map[string]*zip.File, len(archive.File))
	appInfo := ""
	for _, file := range archive.File {
		entries[file.Name] = file
		parts := strings.Split(file.Name, "/")
		if len(parts) == 3 && parts[0] == "Payload" && strings.HasSuffix(parts[1], ".app") && parts[2] == "Info.plist" {
			appInfo = file.Name
		}
	}
	if appInfo == "" {
		return fmt.Errorf("final IPA has no app Info.plist")
	}
	appData, err := readZipEntry(entries[appInfo])
	if err != nil {
		return err
	}
	appID, err := plistValue(appData, "CFBundleIdentifier")
	if err != nil || appID == "" {
		return fmt.Errorf("could not read the app's bundle identifier: %v", err)
	}
	appDir := strings.TrimSuffix(appInfo, "Info.plist")
	for _, name := range []string{"Share", "OpenInDiscord"} {
		extensionDir := appDir + "PlugIns/" + name + ".appex/"
		info := entries[extensionDir+"Info.plist"]
		if info == nil {
			return fmt.Errorf("final IPA is missing %s.appex", name)
		}
		data, err := readZipEntry(info)
		if err != nil {
			return err
		}
		id, err := plistValue(data, "CFBundleIdentifier")
		if err != nil {
			return fmt.Errorf("could not read %s.appex's bundle identifier: %w", name, err)
		}
		if !strings.HasPrefix(id, appID+".") {
			return fmt.Errorf("%s.appex has bundle identifier %q, which iOS ignores outside %s", name, id, appID)
		}
		if name != "Share" {
			continue
		}
		scheme, err := plistValue(data, "URLScheme")
		if err != nil || scheme == "" {
			return fmt.Errorf("Share.appex names no URL scheme to open Discord with")
		}
		executable, err := plistValue(data, "CFBundleExecutable")
		if err != nil || entries[extensionDir+executable] == nil {
			return fmt.Errorf("could not find Share.appex's executable")
		}
		binary, err := readZipEntry(entries[extensionDir+executable])
		if err != nil {
			return err
		}
		if !bytes.Contains(binary, []byte(shareAppGroup)) {
			return fmt.Errorf("Share.appex is not signed with the %s app group, so Discord cannot read shared files", shareAppGroup)
		}
	}
	return nil
}
