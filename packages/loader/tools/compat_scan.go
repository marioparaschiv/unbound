package main

import (
	"archive/zip"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"io/fs"
	"os"
	"regexp"
	"sort"
	"strings"
	"time"
)

const (
	compatOK         = "ok"
	compatBroken     = "broken"
	compatPossible   = "possible"
	compatUnverified = "unverified"
	compatExternal   = "external"
)

var compatEnvironmentClasses = map[string]string{
	"LCSharedUtils": "LiveContainer's own class, present only when Discord runs inside LiveContainer, so its absence is expected",
}

type compatTarget struct {
	Platform  string `json:"platform"`
	Version   string `json:"version"`
	Build     string `json:"build,omitempty"`
	hermes    *hermesStrings
	objc      *objcIndex
	dex       *dexIndex
	sdk       *iosSDKIndex
	framework *javaFrameworkIndex
	own       *javaFrameworkIndex
}

type compatFinding struct {
	Reference *compatReference `json:"reference"`
	Platform  string           `json:"platform"`
	Status    string           `json:"status"`
	Reason    string           `json:"reason,omitempty"`
	New       bool             `json:"new,omitempty"`
}

type compatPlatformState struct {
	Version  string            `json:"version,omitempty"`
	Seen     []string          `json:"seen"`
	Statuses map[string]string `json:"statuses"`
}

type compatResults struct {
	GeneratedAt  string                          `json:"generatedAt"`
	Channel      string                          `json:"channel,omitempty"`
	Targets      []*compatTarget                 `json:"targets"`
	Findings     []compatFinding                 `json:"findings"`
	Dynamic      map[string]int                  `json:"dynamic"`
	DynamicSites []compatDynamicSite             `json:"dynamicSites,omitempty"`
	Platforms    map[string]*compatPlatformState `json:"platforms"`
}

type stringList []string

func (list *stringList) String() string { return strings.Join(*list, ",") }

func (list *stringList) Set(value string) error {
	*list = append(*list, value)
	return nil
}

func runCompatScan(args []string) error {
	set := flag.NewFlagSet("compat-scan", flag.ContinueOnError)
	root := set.String("root", "../..", "monorepo root")
	ipa := set.String("ipa", "", "decrypted Discord IPA")
	var apks stringList
	set.Var(&apks, "apk", "Discord APK (repeatable for splits)")
	androidVersion := set.String("android-version", "", "Discord Android version")
	baselinePath := set.String("baseline", "", "previous results JSON")
	resultsPath := set.String("results", "", "results JSON output")
	reportPath := set.String("report", "", "markdown report output")
	channel := set.String("channel", "", "release channel label")
	sourceURL := set.String("source-url", "", "base URL linking report locations to the source")
	iosSDK := set.String("ios-sdk", "", "iPhoneOS SDK path (found with xcrun when empty)")
	androidJar := set.String("android-jar", "", "android.jar from the Android SDK (found under ANDROID_HOME when empty)")
	if err := set.Parse(args); err != nil {
		return err
	}
	if *ipa == "" && len(apks) == 0 {
		return errors.New("usage: compat-scan --ipa <path> --apk <path> [--android-version <v>] [--baseline <json>] [--results <json>] [--report <md>]")
	}

	sources, err := collectCompatReferences(*root)
	if err != nil {
		return err
	}
	references := sources.sorted()

	var targets []*compatTarget
	if *ipa != "" {
		target, err := loadIOSTarget(*ipa)
		if err != nil {
			return fmt.Errorf("iOS: %w", err)
		}
		if *iosSDK == "" {
			*iosSDK = discoverIOSSDK()
		}
		if *iosSDK != "" {
			if target.sdk, err = loadIOSSDKIndex(*iosSDK); err != nil {
				return fmt.Errorf("iOS SDK: %w", err)
			}
		} else {
			fmt.Fprintln(os.Stderr, "compat-scan: no iOS SDK found, members Discord inherits from UIKit stay unverified")
		}
		targets = append(targets, target)
	}
	if len(apks) > 0 {
		target, err := loadAndroidTarget(apks, *androidVersion)
		if err != nil {
			return fmt.Errorf("Android: %w", err)
		}
		if *androidJar == "" {
			*androidJar = discoverAndroidJar()
		}
		if *androidJar != "" {
			if target.framework, err = loadJavaFrameworkIndex(*androidJar); err != nil {
				return fmt.Errorf("android.jar: %w", err)
			}
		} else {
			fmt.Fprintln(os.Stderr, "compat-scan: no android.jar found, members Discord inherits from Android stay unverified")
		}
		if target.own, err = loadOwnJavaIndex(*root); err != nil {
			return fmt.Errorf("loader sources: %w", err)
		}
		targets = append(targets, target)
	}

	baseline, err := readCompatBaseline(*baselinePath)
	if err != nil {
		return err
	}
	results := evaluateCompat(references, targets, baseline)
	results.Channel = *channel
	results.Dynamic = sources.dynamic
	results.DynamicSites = sources.dynamicSites
	results.GeneratedAt = time.Now().UTC().Format(time.RFC3339)

	report := renderCompatReportWithSource(results, *sourceURL)
	if *reportPath != "" {
		if err := os.WriteFile(*reportPath, []byte(report), 0o644); err != nil {
			return err
		}
	} else {
		fmt.Print(report)
	}
	if *resultsPath != "" {
		encoded, err := json.MarshalIndent(results, "", "  ")
		if err != nil {
			return err
		}
		if err := os.WriteFile(*resultsPath, encoded, 0o644); err != nil {
			return err
		}
	}
	return nil
}

func readCompatBaseline(path string) (*compatResults, error) {
	if path == "" {
		return nil, nil
	}
	data, err := os.ReadFile(path)
	if errors.Is(err, fs.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	var baseline compatResults
	if err := json.Unmarshal(data, &baseline); err != nil {
		return nil, fmt.Errorf("baseline: %w", err)
	}
	return &baseline, nil
}

func readZipEntry(file *zip.File) ([]byte, error) {
	reader, err := file.Open()
	if err != nil {
		return nil, err
	}
	defer reader.Close()
	return io.ReadAll(reader)
}

func loadIOSTarget(path string) (*compatTarget, error) {
	metadata, err := readIPAMetadata(path)
	if err != nil {
		return nil, err
	}
	target := &compatTarget{Platform: "ios", Version: metadata.Version, Build: metadata.Build, objc: newObjCIndex()}
	archive, err := zip.OpenReader(path)
	if err != nil {
		return nil, err
	}
	defer archive.Close()
	bundlePattern := regexp.MustCompile(`^Payload/[^/]+\.app/main\.jsbundle$`)
	for _, file := range archive.File {
		if !strings.HasPrefix(file.Name, "Payload/") || file.FileInfo().IsDir() {
			continue
		}
		if bundlePattern.MatchString(file.Name) {
			data, err := readZipEntry(file)
			if err != nil {
				return nil, err
			}
			if target.hermes, err = parseHermesStrings(data); err != nil {
				return nil, err
			}
			continue
		}
		if file.UncompressedSize64 < 4096 || strings.Contains(file.Name, ".appex/") {
			continue
		}
		reader, err := file.Open()
		if err != nil {
			return nil, err
		}
		header := make([]byte, 4)
		_, readErr := io.ReadFull(reader, header)
		reader.Close()
		if readErr != nil || !isMachO(header) {
			continue
		}
		data, err := readZipEntry(file)
		if err != nil {
			return nil, err
		}
		if err := addMachOToIndex(target.objc, data); err != nil {
			return nil, fmt.Errorf("%s: %w", file.Name, err)
		}
	}
	if target.hermes == nil {
		return nil, errors.New("the IPA has no Hermes bundle")
	}
	return target, nil
}

func loadAndroidTarget(paths []string, version string) (*compatTarget, error) {
	target := &compatTarget{Platform: "android", Version: version, dex: newDexIndex()}
	for _, path := range paths {
		archive, err := zip.OpenReader(path)
		if err != nil {
			return nil, err
		}
		for _, file := range archive.File {
			switch {
			case file.Name == "assets/index.android.bundle":
				data, err := readZipEntry(file)
				if err != nil {
					archive.Close()
					return nil, err
				}
				if target.hermes, err = parseHermesStrings(data); err != nil {
					archive.Close()
					return nil, err
				}
			case strings.HasSuffix(file.Name, ".dex") && !strings.Contains(file.Name, "/"):
				data, err := readZipEntry(file)
				if err != nil {
					archive.Close()
					return nil, err
				}
				if err := addDexToIndex(target.dex, data); err != nil {
					archive.Close()
					return nil, fmt.Errorf("%s: %w", file.Name, err)
				}
			}
		}
		archive.Close()
	}
	if target.hermes == nil {
		return nil, errors.New("the APK has no Hermes bundle")
	}
	return target, nil
}

var appleClassPrefixes = []string{
	"NS", "UI", "CA", "CG", "CF", "AV", "CH", "AS", "LS", "SF", "WK", "MK", "PH", "UN", "LA", "SK", "CL", "CN",
	"EK", "GK", "HK", "MP", "PK", "QL", "SC", "ST", "VN", "WC", "CI", "CT", "CX", "IN", "MTL", "NE", "OS", "RP",
	"SL", "UT", "BS", "FB", "SB", "AX", "_UI", "_NS", "LC",
}

func isAppleClassName(name string) bool {
	for _, prefix := range appleClassPrefixes {
		if strings.HasPrefix(name, prefix) && len(name) > len(prefix) && name[len(prefix)] >= 'A' && name[len(prefix)] <= 'Z' {
			return true
		}
	}
	return false
}

var systemJavaPrefixes = []string{"android.", "java.", "javax.", "dalvik.", "org.json.", "org.w3c.", "org.xml.", "libcore."}

func isSystemJavaClass(name string) bool {
	for _, prefix := range systemJavaPrefixes {
		if strings.HasPrefix(name, prefix) {
			return true
		}
	}
	return false
}

func similarClassNames(name string, classes []string) string {
	short := name
	if dot := strings.LastIndex(name, "."); dot >= 0 {
		short = name[dot+1:]
	}
	var matches []string
	for _, candidate := range classes {
		candidateShort := candidate
		if dot := strings.LastIndex(candidate, "."); dot >= 0 {
			candidateShort = candidate[dot+1:]
		}
		if candidate != name && (candidateShort == short || strings.HasPrefix(candidateShort, short)) {
			matches = append(matches, candidate)
		}
	}
	sort.Slice(matches, func(left, right int) bool {
		if len(matches[left]) != len(matches[right]) {
			return len(matches[left]) < len(matches[right])
		}
		return matches[left] < matches[right]
	})
	if len(matches) == 0 {
		return ""
	}
	if len(matches) > 3 {
		matches = matches[:3]
	}
	return " (similar: " + describeTerms(matches) + ")"
}

func sortedObjCClassNames(index *objcIndex) []string {
	names := make([]string, 0, len(index.Classes))
	for name := range index.Classes {
		if !strings.HasPrefix(name, "category:") {
			names = append(names, name)
		}
	}
	return names
}

func sortedDexClassNames(index *dexIndex) []string {
	names := make([]string, 0, len(index.Classes))
	for name := range index.Classes {
		names = append(names, name)
	}
	return names
}

func isSystemReference(reference *compatReference, target *compatTarget) bool {
	owner := reference.Class
	if reference.Kind == referenceObjCClass || reference.Kind == referenceJavaClass {
		owner = reference.Name
	}
	switch reference.Kind {
	case referenceObjCClass, referenceObjCMethod:
		return target.sdk == nil && owner != "" && isAppleClassName(owner)
	case referenceJavaClass, referenceJavaMethod:
		return target.framework == nil && owner != "" && isSystemJavaClass(owner)
	}
	return false
}

func describeTerms(terms []string) string {
	quoted := make([]string, len(terms))
	for index, term := range terms {
		quoted[index] = "`" + term + "`"
	}
	return strings.Join(quoted, ", ")
}

func evaluateReference(reference *compatReference, target *compatTarget, seen map[string]bool) (string, string) {
	key := reference.key()
	unlessSeen := func(reason string) (string, string) {
		if seen[key] {
			return compatBroken, reason + ", but it was found in an earlier Discord build"
		}
		return compatUnverified, reason
	}

	switch reference.Kind {
	case referenceModulePath, referenceStore, referenceName:
		if target.hermes.has(reference.Name) {
			return compatOK, ""
		}
		return compatBroken, "`" + reference.Name + "` is not in the Hermes bundle"
	case referenceProps, referencePrototypes:
		var missing, plain []string
		for _, term := range reference.Terms {
			switch {
			case !target.hermes.has(term):
				missing = append(missing, term)
			case !target.hermes.isIdentifier(term):
				plain = append(plain, term)
			}
		}
		if len(missing) > 0 {
			return compatBroken, describeTerms(missing) + " not in the Hermes bundle"
		}
		if len(plain) > 0 {
			return compatPossible, describeTerms(plain) + " only appears as a string, never as a property name"
		}
		return compatOK, ""
	}

	if target.objc != nil {
		if status, reason, ok := evaluateObjCReference(reference, target, seen, unlessSeen); ok {
			return status, reason
		}
	}
	if target.dex != nil {
		if status, reason, ok := evaluateJavaReference(reference, target, unlessSeen); ok {
			return status, reason
		}
	}
	return "", ""
}

func evaluateCompat(references []*compatReference, targets []*compatTarget, baseline *compatResults) *compatResults {
	results := &compatResults{Targets: targets, Platforms: map[string]*compatPlatformState{}}
	for _, target := range targets {
		previous := &compatPlatformState{Statuses: map[string]string{}}
		if baseline != nil && baseline.Platforms[target.Platform] != nil {
			previous = baseline.Platforms[target.Platform]
		}
		seen := map[string]bool{}
		for _, key := range previous.Seen {
			seen[key] = true
		}
		state := &compatPlatformState{Version: target.Version, Statuses: map[string]string{}}

		for _, reference := range references {
			applies := false
			for _, platform := range reference.platforms() {
				applies = applies || platform == target.Platform
			}
			if !applies || isSystemReference(reference, target) || target.own == nil && (isOwnJavaName(reference.Name) || isOwnJavaName(reference.Class)) {
				continue
			}
			status, reason := evaluateReference(reference, target, seen)
			if status == "" {
				continue
			}
			key := reference.key()
			if status == compatOK {
				seen[key] = true
			}
			if worse(status, state.Statuses[key]) {
				state.Statuses[key] = status
			}
			finding := compatFinding{Reference: reference, Platform: target.Platform, Status: status, Reason: reason}
			if status == compatBroken || status == compatPossible {
				before, known := previous.Statuses[key]
				finding.New = known && before != status && before != compatBroken
			}
			results.Findings = append(results.Findings, finding)
		}
		for key := range seen {
			state.Seen = append(state.Seen, key)
		}
		sort.Strings(state.Seen)
		results.Platforms[target.Platform] = state
	}
	return results
}

func compatSeverity(status string) int {
	switch status {
	case compatBroken:
		return 3
	case compatPossible:
		return 2
	case compatUnverified:
		return 1
	case compatOK, compatExternal:
		return 0
	}
	return -1
}

func worse(status, existing string) bool {
	return existing == "" || compatSeverity(status) > compatSeverity(existing)
}
