package main

import (
	"archive/zip"
	"embed"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path"
	"path/filepath"
	"strconv"
	"strings"
)

//go:embed assets/ipa-icons/*.png assets/ipa-icons/animated/*.png assets/ipa-icons/animated/*.gif assets/ipa-icons/animated/frames.json
var ipaIcons embed.FS

type animatedIcon struct {
	Name      string `json:"name"`
	Preview   string `json:"preview"`
	Rest      int    `json:"rest"`
	Durations []int  `json:"durations"`
}

const (
	ipaIconDirectory     = "assets/ipa-icons"
	animatedIconDir      = "assets/ipa-icons/animated"
	animatedIconPrefix   = "UnboundAnimated"
	animatedIconKey      = "UnboundAnimatedIcon"
	unboundAppName       = "Unbound"
	unboundAlternateIcon = "UnboundIcon"
	unboundURLScheme     = "unbound"
	unboundURLName       = "app.unbound.rip"
	// The debugger bridge's Bonjour type; iOS refuses to browse a type the app does not declare.
	unboundBonjourService = "_unbound-bridge._tcp"
	// Shown in iOS's Local Network prompt, unless Discord declares its own text.
	unboundLocalNetworkUsage = "Unbound's debugger finds and connects to the debugger bridge on your computer over the local network."
	unboundSpeechUsage       = "Unbound plugins turn voice messages into text."
)

// cyanInputs writes the Info.plist keys cyan merges into the IPA: the loader version for every channel, and
// Unbound's name, icons and local network keys unless branding is off (TestFlight keeps Discord's).
func cyanInputs(ipa, dir, loader string, branding bool) ([]string, []string, error) {
	info, err := readIPAInfoPlist(ipa)
	if err != nil {
		return nil, nil, err
	}

	merge, err := mergePlist(info, loader, branding)
	if err != nil {
		return nil, nil, err
	}

	plistPath := filepath.Join(dir, "merge.plist")
	if err := os.WriteFile(plistPath, merge, 0o644); err != nil {
		return nil, nil, err
	}

	if !branding {
		return []string{"-l", plistPath}, nil, nil
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

func mergePlist(data []byte, loader string, branding bool) ([]byte, error) {
	info, err := readPlist(data)
	if err != nil {
		return nil, err
	}

	if info.kind != plistDictKind {
		return nil, errors.New("Info.plist is not a dictionary")
	}

	merge := newPlistDict()
	if err := setSideloadVersion(info, merge, loader); err != nil {
		return nil, err
	}

	if info.get("NSSpeechRecognitionUsageDescription") == nil {
		merge.set("NSSpeechRecognitionUsageDescription", plistText(unboundSpeechUsage))
	}

	if !branding {
		return writePlist(merge)
	}

	setAlternateIcon(info, "CFBundleIcons", unboundAlternateIcon, "UnboundIcon60x60")
	setAlternateIcon(info, "CFBundleIcons~ipad", unboundAlternateIcon, "UnboundIcon60x60", "UnboundIcon76x76")

	animated, err := readAnimatedIcon()
	if err != nil {
		return nil, err
	}

	for index := range animated.Durations {
		frame := animatedFrameID(index)
		setAlternateIcon(info, "CFBundleIcons", frame, frame+"60x60")
		setAlternateIcon(info, "CFBundleIcons~ipad", frame, frame+"60x60", frame+"76x76")
	}

	addURLScheme(info)
	addBonjourService(info)

	if info.get("NSLocalNetworkUsageDescription") == nil {
		info.set("NSLocalNetworkUsageDescription", plistText(unboundLocalNetworkUsage))
	}

	for _, key := range []string{"CFBundleIcons", "CFBundleIcons~ipad", "CFBundleURLTypes", "NSBonjourServices", "NSLocalNetworkUsageDescription"} {
		merge.set(key, info.get(key))
	}

	merge.set(animatedIconKey, animatedIconPlist(animated))

	return writePlist(merge)
}

func readAnimatedIcon() (animatedIcon, error) {
	var icon animatedIcon

	data, err := ipaIcons.ReadFile(path.Join(animatedIconDir, "frames.json"))
	if err != nil {
		return icon, err
	}

	if err := json.Unmarshal(data, &icon); err != nil {
		return icon, fmt.Errorf("reading the animated icon's frames failed: %w", err)
	}

	if len(icon.Durations) == 0 || icon.Rest < 0 || icon.Rest >= len(icon.Durations) {
		return icon, errors.New("the animated icon needs frames and a rest frame among them")
	}

	return icon, nil
}

func animatedFrameID(index int) string {
	return fmt.Sprintf("%s%02d", animatedIconPrefix, index)
}

func animatedIconPlist(icon animatedIcon) *plistNode {
	frames := make([]string, len(icon.Durations))
	durations := &plistNode{kind: plistArrayKind}

	for index, duration := range icon.Durations {
		frames[index] = animatedFrameID(index)

		durations.values = append(durations.values, &plistNode{kind: "integer", text: strconv.Itoa(duration)})
	}

	node := newPlistDict()
	node.set("Name", plistText(icon.Name))
	node.set("Preview", plistText(icon.Preview))
	node.set("Rest", plistText(animatedFrameID(icon.Rest)))
	node.set("Frames", plistStrings(frames...))
	node.set("Durations", durations)

	return node
}

func writeIPAIcons(dir string) ([]string, error) {
	var paths []string

	for _, directory := range []string{ipaIconDirectory, animatedIconDir} {
		icons, err := ipaIcons.ReadDir(directory)
		if err != nil {
			return nil, err
		}

		for _, icon := range icons {
			if icon.IsDir() || path.Ext(icon.Name()) == ".json" {
				continue
			}

			data, err := ipaIcons.ReadFile(path.Join(directory, icon.Name()))
			if err != nil {
				return nil, err
			}

			target := filepath.Join(dir, icon.Name())
			if err := os.WriteFile(target, data, 0o644); err != nil {
				return nil, err
			}

			paths = append(paths, target)
		}
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

func setAlternateIcon(root *plistNode, key, id string, files ...string) {
	icon := newPlistDict()
	icon.set("CFBundleIconFiles", plistStrings(files...))
	root.dict(key).dict("CFBundleAlternateIcons").set(id, icon)
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
