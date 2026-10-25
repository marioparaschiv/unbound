package main

import (
	"archive/zip"
	"embed"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"path"
	"path/filepath"
	"strings"
)

//go:embed assets/ipa-icons/*.png
var ipaIcons embed.FS

const (
	ipaIconDirectory        = "assets/ipa-icons"
	unboundAppName          = "Unbound"
	unboundAlternateIcon    = "UnboundIcon"
	unboundURLScheme        = "unbound"
	unboundURLName          = "app.unbound.rip"
	reactNavigationElements = "@react-navigation+elements"
	patchedReactNavigation  = "@react-navigation+elements@patched"
	pnpmModules             = "assets/_node_modules/.pnpm/"
)

func runPatchIPA(args []string) error {
	set := flag.NewFlagSet("patch-ipa", flag.ContinueOnError)
	input := set.String("ipa", "", "Discord IPA to patch")
	output := set.String("output", "", "path of the patched IPA")
	if err := set.Parse(args); err != nil {
		return err
	}
	if *input == "" || *output == "" {
		return errors.New("usage: patch-ipa --ipa <path> --output <path>")
	}
	if err := patchIPA(*input, *output); err != nil {
		return err
	}
	fmt.Println("patched", *output)
	return nil
}

func patchIPA(input, output string) error {
	reader, err := zip.OpenReader(input)
	if err != nil {
		return err
	}
	defer reader.Close()
	app, err := discordAppPrefix(reader.File)
	if err != nil {
		return err
	}
	icons, err := ipaIcons.ReadDir(ipaIconDirectory)
	if err != nil {
		return err
	}
	iconNames := make(map[string]bool, len(icons))
	for _, icon := range icons {
		iconNames[app+icon.Name()] = true
	}
	renamesModules := hasEntryUnder(reader.File, app+pnpmModules)

	if err := os.MkdirAll(filepath.Dir(output), 0o755); err != nil {
		return err
	}
	partial := output + ".partial"
	file, err := os.Create(partial)
	if err != nil {
		return err
	}
	defer os.Remove(partial)
	writer := zip.NewWriter(file)

	for _, entry := range reader.File {
		if iconNames[entry.Name] {
			continue
		}
		if err := copyPatchedEntry(writer, entry, app, renamesModules); err != nil {
			file.Close()
			return fmt.Errorf("could not patch %s: %w", entry.Name, err)
		}
	}
	for _, icon := range icons {
		data, err := ipaIcons.ReadFile(path.Join(ipaIconDirectory, icon.Name()))
		if err != nil {
			file.Close()
			return err
		}
		header := &zip.FileHeader{Name: app + icon.Name(), Method: zip.Deflate}
		header.SetMode(0o644)
		if err := writeZipEntry(writer, header, data); err != nil {
			file.Close()
			return err
		}
	}

	if err := writer.Close(); err != nil {
		file.Close()
		return err
	}
	if err := file.Close(); err != nil {
		return err
	}
	return os.Rename(partial, output)
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

func hasEntryUnder(entries []*zip.File, prefix string) bool {
	for _, entry := range entries {
		if strings.HasPrefix(entry.Name, prefix) && len(entry.Name) > len(prefix) {
			return true
		}
	}
	return false
}

func copyPatchedEntry(writer *zip.Writer, entry *zip.File, app string, renamesModules bool) error {
	switch {
	case entry.Name == app+"Info.plist":
		return rewriteZipEntry(writer, entry, patchInfoPlist)
	case renamesModules && entry.Name == app+"manifest.json":
		return rewriteZipEntry(writer, entry, patchBundleManifest)
	}
	name := entry.Name
	if renamesModules {
		name = renamePnpmModule(name, app+pnpmModules)
	}
	if name == entry.Name {
		return writer.Copy(entry)
	}
	header := entry.FileHeader
	header.Name = name
	raw, err := entry.OpenRaw()
	if err != nil {
		return err
	}
	target, err := writer.CreateRaw(&header)
	if err != nil {
		return err
	}
	_, err = io.Copy(target, raw)
	return err
}

func rewriteZipEntry(writer *zip.Writer, entry *zip.File, patch func([]byte) ([]byte, error)) error {
	reader, err := entry.Open()
	if err != nil {
		return err
	}
	data, readErr := io.ReadAll(reader)
	closeErr := reader.Close()
	if readErr != nil {
		return readErr
	}
	if closeErr != nil {
		return closeErr
	}
	patched, err := patch(data)
	if err != nil {
		return err
	}
	header := &zip.FileHeader{Name: entry.Name, Method: zip.Deflate, Modified: entry.Modified}
	header.SetMode(entry.Mode())
	return writeZipEntry(writer, header, patched)
}

func writeZipEntry(writer *zip.Writer, header *zip.FileHeader, data []byte) error {
	target, err := writer.CreateHeader(header)
	if err != nil {
		return err
	}
	_, err = target.Write(data)
	return err
}

func renamePnpmModule(name, modules string) string {
	if !strings.HasPrefix(name, modules) {
		return name
	}
	rest := strings.TrimPrefix(name, modules)
	module, remainder, _ := strings.Cut(rest, "/")
	if !strings.Contains(module, reactNavigationElements) {
		return name
	}
	if remainder == "" && !strings.HasSuffix(rest, "/") {
		return modules + patchedReactNavigation
	}
	return modules + patchedReactNavigation + "/" + remainder
}

func patchBundleManifest(data []byte) ([]byte, error) {
	var manifest map[string]json.RawMessage
	if err := json.Unmarshal(data, &manifest); err != nil {
		return nil, fmt.Errorf("could not parse manifest.json: %w", err)
	}
	raw, ok := manifest["hashes"]
	if !ok {
		return data, nil
	}
	var hashes map[string]json.RawMessage
	if err := json.Unmarshal(raw, &hashes); err != nil {
		return nil, fmt.Errorf("could not parse manifest.json hashes: %w", err)
	}
	renamed := make(map[string]json.RawMessage, len(hashes))
	for key, value := range hashes {
		segments := strings.Split(key, "/")
		for index, segment := range segments {
			if strings.Contains(segment, reactNavigationElements) {
				segments[index] = patchedReactNavigation
			}
		}
		renamed[strings.Join(segments, "/")] = value
	}
	encoded, err := json.Marshal(renamed)
	if err != nil {
		return nil, err
	}
	manifest["hashes"] = encoded
	return json.Marshal(manifest)
}

func patchInfoPlist(data []byte) ([]byte, error) {
	root, err := readPlist(data)
	if err != nil {
		return nil, err
	}
	if root.kind != plistDictKind {
		return nil, errors.New("Info.plist is not a dictionary")
	}
	root.remove("UISupportedDevices")
	root.set("CFBundleName", plistText(unboundAppName))
	root.set("CFBundleDisplayName", plistText(unboundAppName))
	root.set("UISupportsDocumentBrowser", plistBool(true))
	root.set("UIFileSharingEnabled", plistBool(true))
	setAlternateIcon(root, "CFBundleIcons", "UnboundIcon60x60")
	setAlternateIcon(root, "CFBundleIcons~ipad", "UnboundIcon60x60", "UnboundIcon76x76")
	addURLScheme(root)
	return writePlist(root)
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

func (node *plistNode) valuesOrNil() []*plistNode {
	if node == nil || node.kind != plistArrayKind {
		return nil
	}
	return node.values
}
