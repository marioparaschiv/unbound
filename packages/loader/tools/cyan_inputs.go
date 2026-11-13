package main

import (
	"archive/zip"
	"embed"
	"errors"
	"io"
	"os"
	"path"
	"path/filepath"
	"strings"
)

//go:embed assets/ipa-icons/*.png
var ipaIcons embed.FS

const (
	ipaIconDirectory     = "assets/ipa-icons"
	unboundAppName       = "Unbound"
	unboundAlternateIcon = "UnboundIcon"
	unboundURLScheme     = "unbound"
	unboundURLName       = "app.unbound.rip"
	// The debugger bridge's Bonjour type; iOS refuses to browse a type the app does not declare.
	unboundBonjourService = "_unbound-bridge._tcp"
	// Shown in iOS's Local Network prompt, unless Discord declares its own text.
	unboundLocalNetworkUsage = "Unbound's debugger finds and connects to the debugger bridge on your computer over the local network."
)

func cyanInputs(ipa, dir string) ([]string, []string, error) {
	info, err := readIPAInfoPlist(ipa)
	if err != nil {
		return nil, nil, err
	}
	merge, err := mergePlist(info)
	if err != nil {
		return nil, nil, err
	}
	plistPath := filepath.Join(dir, "merge.plist")
	if err := os.WriteFile(plistPath, merge, 0o644); err != nil {
		return nil, nil, err
	}
	icons, err := writeIPAIcons(dir)
	if err != nil {
		return nil, nil, err
	}
	return []string{"-l", plistPath, "-n", unboundAppName}, icons, nil
}

func readIPAInfoPlist(ipa string) ([]byte, error) {
	reader, err := zip.OpenReader(ipa)
	if err != nil {
		return nil, err
	}
	defer reader.Close()
	app, err := discordAppPrefix(reader.File)
	if err != nil {
		return nil, err
	}
	for _, entry := range reader.File {
		if entry.Name != app+"Info.plist" {
			continue
		}
		file, err := entry.Open()
		if err != nil {
			return nil, err
		}
		defer file.Close()
		return io.ReadAll(file)
	}
	return nil, errors.New("IPA contains no application Info.plist")
}

func mergePlist(data []byte) ([]byte, error) {
	info, err := readPlist(data)
	if err != nil {
		return nil, err
	}
	if info.kind != plistDictKind {
		return nil, errors.New("Info.plist is not a dictionary")
	}
	setAlternateIcon(info, "CFBundleIcons", "UnboundIcon60x60")
	setAlternateIcon(info, "CFBundleIcons~ipad", "UnboundIcon60x60", "UnboundIcon76x76")
	addURLScheme(info)
	addBonjourService(info)
	if info.get("NSLocalNetworkUsageDescription") == nil {
		info.set("NSLocalNetworkUsageDescription", plistText(unboundLocalNetworkUsage))
	}
	merge := newPlistDict()
	for _, key := range []string{"CFBundleIcons", "CFBundleIcons~ipad", "CFBundleURLTypes", "NSBonjourServices", "NSLocalNetworkUsageDescription"} {
		merge.set(key, info.get(key))
	}
	return writePlist(merge)
}

func writeIPAIcons(dir string) ([]string, error) {
	icons, err := ipaIcons.ReadDir(ipaIconDirectory)
	if err != nil {
		return nil, err
	}
	paths := make([]string, 0, len(icons))
	for _, icon := range icons {
		data, err := ipaIcons.ReadFile(path.Join(ipaIconDirectory, icon.Name()))
		if err != nil {
			return nil, err
		}
		target := filepath.Join(dir, icon.Name())
		if err := os.WriteFile(target, data, 0o644); err != nil {
			return nil, err
		}
		paths = append(paths, target)
	}
	return paths, nil
}

func discordAppPrefix(entries []*zip.File) (string, error) {
	var fallback string
	for _, entry := range entries {
		parts := strings.Split(entry.Name, "/")
		if len(parts) != 3 || parts[0] != "Payload" || !strings.HasSuffix(parts[1], ".app") || parts[2] != "Info.plist" {
			continue
		}
		prefix := "Payload/" + parts[1] + "/"
		if parts[1] == "Discord.app" {
			return prefix, nil
		}
		if fallback == "" {
			fallback = prefix
		}
	}
	if fallback == "" {
		return "", errors.New("IPA contains no application Info.plist")
	}
	return fallback, nil
}

func setAlternateIcon(root *plistNode, key string, files ...string) {
	icon := newPlistDict()
	icon.set("CFBundleIconFiles", plistStrings(files...))
	root.dict(key).dict("CFBundleAlternateIcons").set(unboundAlternateIcon, icon)
}

func addURLScheme(root *plistNode) {
	types := root.get("CFBundleURLTypes")
	if types == nil || types.kind != plistArrayKind {
		types = &plistNode{kind: plistArrayKind}
		root.set("CFBundleURLTypes", types)
	}
	for _, entry := range types.values {
		for _, scheme := range entry.get("CFBundleURLSchemes").valuesOrNil() {
			if scheme.text == unboundURLScheme {
				return
			}
		}
	}
	scheme := newPlistDict()
	scheme.set("CFBundleTypeRole", plistText("Editor"))
	scheme.set("CFBundleURLName", plistText(unboundURLName))
	scheme.set("CFBundleURLSchemes", plistStrings(unboundURLScheme))
	types.values = append(types.values, scheme)
}

// Appends the bridge's type to Discord's own, since cyan replaces the array whole.
func addBonjourService(root *plistNode) {
	services := root.get("NSBonjourServices")
	if services == nil || services.kind != plistArrayKind {
		services = &plistNode{kind: plistArrayKind}
		root.set("NSBonjourServices", services)
	}
	for _, service := range services.values {
		if service.text == unboundBonjourService {
			return
		}
	}
	services.values = append(services.values, plistText(unboundBonjourService))
}

func (node *plistNode) valuesOrNil() []*plistNode {
	if node == nil || node.kind != plistArrayKind {
		return nil
	}
	return node.values
}
