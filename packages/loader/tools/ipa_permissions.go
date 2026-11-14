package main

import (
	"archive/zip"
	"slices"
	"strings"
)

type ipaPermissions struct {
	Entitlements []string          `json:"entitlements"`
	Privacy      map[string]string `json:"privacy"`
}

func readIPAPermissions(path string) (ipaPermissions, error) {
	archive, err := zip.OpenReader(path)
	if err != nil {
		return ipaPermissions{}, err
	}
	defer archive.Close()
	entries := make(map[string]*zip.File, len(archive.File))
	for _, file := range archive.File {
		entries[file.Name] = file
	}
	app, err := ipaAppDirectory(archive.File)
	if err != nil {
		return ipaPermissions{}, err
	}
	permissions := ipaPermissions{Entitlements: []string{}, Privacy: map[string]string{}}
	for _, bundle := range ipaBundles(archive.File, app) {
		if err := addBundlePermissions(entries, bundle, &permissions); err != nil {
			return ipaPermissions{}, err
		}
	}
	slices.Sort(permissions.Entitlements)
	permissions.Entitlements = slices.Compact(permissions.Entitlements)
	return permissions, nil
}

func ipaBundles(files []*zip.File, app string) []string {
	bundles := []string{app}
	for _, file := range files {
		rest, ok := strings.CutPrefix(file.Name, app+"PlugIns/")
		parts := strings.Split(rest, "/")
		if ok && len(parts) == 2 && parts[1] == "Info.plist" && strings.HasSuffix(parts[0], ".appex") {
			bundles = append(bundles, app+"PlugIns/"+parts[0]+"/")
		}
	}
	return bundles
}

func addBundlePermissions(entries map[string]*zip.File, bundle string, permissions *ipaPermissions) error {
	file := entries[bundle+"Info.plist"]
	if file == nil {
		return nil
	}
	data, err := readZipEntry(file)
	if err != nil {
		return err
	}
	info, err := readPlist(data)
	if err != nil {
		return err
	}
	for index, key := range info.keys {
		if isPrivacyKey(key) && permissions.Privacy[key] == "" {
			permissions.Privacy[key] = strings.TrimSpace(info.values[index].text)
		}
	}
	executableNode := info.get("CFBundleExecutable")
	if executableNode == nil || entries[bundle+strings.TrimSpace(executableNode.text)] == nil {
		return nil
	}
	binary, err := readZipEntry(entries[bundle+strings.TrimSpace(executableNode.text)])
	if err != nil {
		return err
	}
	permissions.Entitlements = append(permissions.Entitlements, entitlementKeys(binary)...)
	return nil
}

func isPrivacyKey(key string) bool {
	return strings.HasPrefix(key, "NS") && strings.HasSuffix(key, "UsageDescription")
}

func entitlementKeys(binary []byte) []string {
	blob := machoEntitlements(binary)
	if blob == nil {
		return nil
	}
	plist, err := readPlist(blob)
	if err != nil {
		return nil
	}
	return slices.Clone(plist.keys)
}
