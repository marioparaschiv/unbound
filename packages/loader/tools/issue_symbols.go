package main

import (
	"debug/macho"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strconv"
	"strings"
)

var (
	loaderStackFramePattern = regexp.MustCompile(`#(\d+)\s+0x[0-9a-fA-F]+\s+(Unbound\.dylib|libunbound[^\s]*\.so)\s+\+\s+0x([0-9a-fA-F]+)`)
	issueLoaderPattern      = regexp.MustCompile(`loader (\d+\.\d+\.\d+)`)
	issuePlatformPattern    = regexp.MustCompile(`\bon (iOS|Android)\b`)
	imageLinePattern        = regexp.MustCompile(`(?m)^Image (\S+) ([0-9A-Fa-f-]+)$`)
)

const symbolicatedMarker = "<!-- unbound-symbolicated -->"

type issueCrash struct {
	platform string
	version  string
	stack    string
	image    imageIdentity
}

type imageIdentity struct {
	name string
	id   string
}

type releaseAsset struct {
	Name string `json:"name"`
}

type symbolRelease struct {
	TagName string         `json:"tag_name"`
	Assets  []releaseAsset `json:"assets"`
}

func runSymbolicateIssue(args []string) error {
	set := flag.NewFlagSet("symbolicate-issue", flag.ContinueOnError)
	repository := set.String("repo", "", "owner/name of the repository the issue is in")
	number := set.Int("issue", 0, "issue number")
	symbolizer := set.String("symbolizer", "", "path to llvm-symbolizer")
	dryRun := set.Bool("dry-run", false, "print the comment instead of posting it")
	if err := set.Parse(args); err != nil {
		return err
	}
	if *repository == "" || *number == 0 {
		return errors.New("usage: symbolicate-issue --repo <owner/name> --issue <number> [--symbolizer <path>] [--dry-run]")
	}
	cli := ghCLI{}
	body, err := cli.run("issue", "view", strconv.Itoa(*number), "--repo", *repository, "--json", "body", "--jq", ".body")
	if err != nil {
		return err
	}
	crash, ok := parseIssueCrash(string(body))
	if !ok {
		fmt.Println("The issue has no native stack with a loader version and platform; nothing to symbolicate.")
		return nil
	}
	listing, err := cli.run("api", "repos/"+*repository+"/releases?per_page=60")
	if err != nil {
		return err
	}
	var releases []symbolRelease
	if err := json.Unmarshal(listing, &releases); err != nil {
		return fmt.Errorf("read releases: %w", err)
	}
	candidates := symbolReleaseCandidates(releases, crash)
	if len(candidates) == 0 {
		fmt.Printf("No release carries %s symbols for loader %s.\n", crash.platform, crash.version)
		return nil
	}
	directory, err := os.MkdirTemp("", "unbound-issue-symbols-")
	if err != nil {
		return err
	}
	defer os.RemoveAll(directory)
	binaryPath, err := findLLVMSymbolizer(*symbolizer)
	if err != nil {
		return err
	}
	archive := symbolArchiveName(crash.platform)
	var tag, output string
	for index, candidate := range candidates {
		target := filepath.Join(directory, strconv.Itoa(index))
		if _, err := cli.run("release", "download", candidate, "--repo", *repository, "--pattern", archive, "--dir", target); err != nil {
			continue
		}
		symbolicated, count, matched, err := symbolicateIssueStack(crash, filepath.Join(target, archive), llvmSymbolizer(binaryPath))
		if err != nil {
			return err
		}
		if matched && count > 0 {
			tag, output = candidate, symbolicated
			break
		}
	}
	if tag == "" {
		fmt.Println("No release has symbols matching this crash's image.")
		return nil
	}
	comment := issueSymbolsComment(tag, crash.version, output)
	if *dryRun {
		fmt.Print(comment)
		return nil
	}
	file := filepath.Join(directory, "comment.md")
	if err := os.WriteFile(file, []byte(comment), 0o600); err != nil {
		return err
	}
	_, err = cli.run("issue", "comment", strconv.Itoa(*number), "--repo", *repository, "--body-file", file)
	return err
}

func parseIssueCrash(body string) (issueCrash, bool) {
	stack := nativeStackSection(body)
	version := issueLoaderPattern.FindStringSubmatch(body)
	platform := issuePlatformPattern.FindStringSubmatch(body)
	if stack == "" || version == nil || platform == nil || strings.Contains(body, symbolicatedMarker) {
		return issueCrash{}, false
	}
	crash := issueCrash{platform: strings.ToLower(platform[1]), version: version[1], stack: stack}
	if match := imageLinePattern.FindStringSubmatch(stack); match != nil {
		crash.image = imageIdentity{name: match[1], id: match[2]}
	}
	return crash, true
}

func nativeStackSection(body string) string {
	start := strings.Index(body, "### Native stack")
	if start < 0 {
		return ""
	}
	section := body[start+len("### Native stack"):]
	if end := strings.Index(section, "\n### "); end >= 0 {
		section = section[:end]
	}
	section = strings.ReplaceAll(section, "```", "")
	return strings.Trim(section, "\r\n")
}

func symbolArchiveName(platform string) string {
	return "unbound-" + platform + "-symbols.zip"
}

const maxSymbolCandidates = 10

func symbolReleaseCandidates(releases []symbolRelease, crash issueCrash) []string {
	var candidates []string
	if tag, ok := pickSymbolRelease(releases, crash); ok {
		candidates = append(candidates, tag)
	}
	if crash.image.id == "" {
		return candidates
	}
	archive := symbolArchiveName(crash.platform)
	for _, release := range releases {
		if len(candidates) >= maxSymbolCandidates {
			break
		}
		if release.TagName == "" || slices.Contains(candidates, release.TagName) {
			continue
		}
		for _, asset := range release.Assets {
			if asset.Name == archive {
				candidates = append(candidates, release.TagName)
				break
			}
		}
	}
	return candidates
}

func pickSymbolRelease(releases []symbolRelease, crash issueCrash) (string, bool) {
	archive := symbolArchiveName(crash.platform)
	versioned := "app.unbound.ios_" + crash.version + "_iphoneos-arm64.deb"
	for _, release := range releases {
		var hasSymbols, hasVersion bool
		for _, asset := range release.Assets {
			hasSymbols = hasSymbols || asset.Name == archive
			hasVersion = hasVersion || asset.Name == versioned
		}
		if hasSymbols && (hasVersion || crash.platform == "android") {
			return release.TagName, true
		}
	}
	return "", false
}

func symbolicateIssueStack(crash issueCrash, archive string, symbolize symbolizeFunc) (string, int, bool, error) {
	directory, cleanup, err := openSymbolDirectory(archive)
	if err != nil {
		return "", 0, false, err
	}
	defer cleanup()
	if crash.platform == "android" {
		files, err := loadSymbolFiles(directory)
		if err != nil {
			return "", 0, false, err
		}
		if crash.image.id != "" {
			for _, file := range files {
				if strings.EqualFold(file.buildID, crash.image.id) {
					output, count, err := symbolicateLoaderStack(crash.stack, file.path, symbolize)
					return output, count, true, err
				}
			}
		}
		output, count, err := symbolicateAndroidBacktrace(crash.stack, "arm64-v8a", files, symbolize)
		return output, count, err == nil && count > 0 && !strings.Contains(output, "symbols are for build ID"), err
	}
	object, err := findDSYMObject(directory)
	if err != nil {
		return "", 0, false, err
	}
	if crash.image.id != "" {
		uuid, err := machOUUID(object)
		if err != nil || !strings.EqualFold(uuid, crash.image.id) {
			return "", 0, false, nil
		}
	}
	output, count, err := symbolicateLoaderStack(crash.stack, object, symbolize)
	return output, count, true, err
}

func machOUUID(path string) (string, error) {
	file, err := macho.Open(path)
	if err != nil {
		return "", err
	}
	defer file.Close()
	for _, load := range file.Loads {
		raw := load.Raw()
		if len(raw) >= 24 && file.ByteOrder.Uint32(raw[0:4]) == machOUUIDCommand {
			hex := strings.ToUpper(fmt.Sprintf("%x", raw[8:24]))
			return hex[0:8] + "-" + hex[8:12] + "-" + hex[12:16] + "-" + hex[16:20] + "-" + hex[20:], nil
		}
	}
	return "", errors.New("the dSYM has no LC_UUID")
}

const machOUUIDCommand = 0x1b

func findDSYMObject(directory string) (string, error) {
	var found string
	err := filepath.WalkDir(directory, func(path string, entry fs.DirEntry, err error) error {
		if err != nil || found != "" {
			return err
		}
		if !entry.IsDir() && strings.Contains(filepath.ToSlash(path), ".dSYM/Contents/Resources/DWARF/") &&
			strings.HasPrefix(entry.Name(), "Unbound") {
			found = path
		}
		return nil
	})
	if err == nil && found == "" {
		err = errors.New("the iOS symbols have no Unbound dSYM")
	}
	return found, err
}

func symbolicateLoaderStack(text, object string, symbolize symbolizeFunc) (string, int, error) {
	lines := strings.SplitAfter(text, "\n")
	var indexes []int
	var addresses []uint64
	for index, line := range lines {
		match := loaderStackFramePattern.FindStringSubmatch(line)
		if match == nil {
			continue
		}
		offset, err := strconv.ParseUint(match[3], 16, 64)
		if err != nil {
			continue
		}
		indexes = append(indexes, index)
		addresses = append(addresses, offset)
	}
	if len(addresses) == 0 {
		return text, 0, nil
	}
	locations, err := symbolize(object, addresses)
	if err != nil {
		return "", 0, err
	}
	if len(locations) != len(addresses) {
		return "", 0, fmt.Errorf("got %d results for %d addresses", len(locations), len(addresses))
	}
	notes := map[int][]string{}
	for position, index := range indexes {
		notes[index] = describeLocations(locations[position])
	}
	var output strings.Builder
	for index, line := range lines {
		output.WriteString(line)
		if len(notes[index]) == 0 {
			continue
		}
		if !strings.HasSuffix(line, "\n") {
			output.WriteString("\n")
		}
		for _, note := range notes[index] {
			output.WriteString(frameIndent(line) + note + "\n")
		}
	}
	return output.String(), len(addresses), nil
}

func issueSymbolsComment(tag, version, stack string) string {
	return symbolicatedMarker + "\n" +
		"Unbound's frames, symbolicated for loader " + version + " with the symbols from release `" + tag + "`:\n\n" +
		"```\n" + strings.TrimRight(stack, "\n") + "\n```\n"
}
