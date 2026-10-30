package main

import (
	"archive/zip"
	"bufio"
	"bytes"
	"debug/elf"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path"
	"path/filepath"
	"regexp"
	"runtime"
	"slices"
	"sort"
	"strconv"
	"strings"
)

var (
	nativeFramePattern  = regexp.MustCompile(`#(\d+)\s+pc\s+(?:0x)?([0-9a-fA-F]+)\s+(\S+)`)
	frameBuildIDPattern = regexp.MustCompile(`\(BuildId: ([0-9a-fA-F]+)\)`)
	tombstoneABIPattern = regexp.MustCompile(`ABI: '([^']+)'`)
	loaderLibraryName   = regexp.MustCompile(`^libastral[^/]*\.so$`)
)

var tombstoneABIs = map[string]string{
	"arm64":  "arm64-v8a",
	"arm":    "armeabi-v7a",
	"x86_64": "x86_64",
	"x86":    "x86",
}

var androidABIs = []string{"arm64-v8a", "armeabi-v7a", "x86_64", "x86"}

const gnuBuildIDNoteType = 3

type nativeFrame struct {
	line    int
	pc      uint64
	abi     string
	library string
	buildID string
}

type sourceLocation struct {
	function string
	file     string
	line     int
	column   int
}

type symbolFile struct {
	path    string
	buildID string
}

type symbolizeFunc func(object string, addresses []uint64) ([][]sourceLocation, error)

func runSymbolicateAndroid(args []string) error {
	set := flag.NewFlagSet("symbolicate-android", flag.ContinueOnError)
	symbols := set.String("symbols", "", "directory or zip of the release's Android symbols, laid out as <abi>/libastral.so[.dbg]")
	abi := set.String("abi", "", "ABI of the crashed process when the backtrace does not name one")
	symbolizer := set.String("symbolizer", "", "path to llvm-symbolizer; defaults to the one in the Android NDK")
	input := set.String("input", "", "tombstone or logcat file; defaults to stdin")
	if err := set.Parse(args); err != nil {
		return err
	}
	if *symbols == "" {
		return errors.New("usage: symbolicate-android --symbols <dir|zip> [--abi <abi>] [--symbolizer <path>] [--input <file>] < tombstone.txt")
	}
	if *abi != "" && !slices.Contains(androidABIs, *abi) {
		return fmt.Errorf("unknown ABI %q, expected one of %s", *abi, strings.Join(androidABIs, ", "))
	}
	text, err := readSymbolicationInput(*input)
	if err != nil {
		return err
	}
	directory, cleanup, err := openSymbolDirectory(*symbols)
	if err != nil {
		return err
	}
	defer cleanup()
	files, err := loadSymbolFiles(directory)
	if err != nil {
		return err
	}
	binaryPath, err := findLLVMSymbolizer(*symbolizer)
	if err != nil {
		return err
	}
	output, count, err := symbolicateAndroidBacktrace(text, *abi, files, llvmSymbolizer(binaryPath))
	if err != nil {
		return err
	}
	fmt.Print(output)
	if count == 0 {
		return errors.New("the input has no libastral frames to symbolicate")
	}
	return nil
}

func readSymbolicationInput(name string) (string, error) {
	if name == "" {
		data, err := io.ReadAll(os.Stdin)
		return string(data), err
	}
	data, err := os.ReadFile(name)
	return string(data), err
}

func symbolicateAndroidBacktrace(text, defaultABI string, files map[string]symbolFile, symbolize symbolizeFunc) (string, int, error) {
	lines := strings.SplitAfter(text, "\n")
	frames := parseNativeFrames(lines, defaultABI)
	notes := map[int][]string{}
	for _, group := range groupFramesBySymbolFile(frames) {
		key := group[0].abi + "/" + group[0].library
		file, ok := files[key]
		if !ok {
			for _, frame := range group {
				notes[frame.line] = []string{fmt.Sprintf("no symbols for %s", describeSymbolKey(frame))}
			}
			continue
		}
		var matching []nativeFrame
		for _, frame := range group {
			if frame.buildID != "" && file.buildID != "" && !strings.EqualFold(frame.buildID, file.buildID) {
				notes[frame.line] = []string{fmt.Sprintf("symbols are for build ID %s, the crash is build ID %s", file.buildID, frame.buildID)}
				continue
			}
			matching = append(matching, frame)
		}
		if len(matching) == 0 {
			continue
		}
		addresses := make([]uint64, len(matching))
		for index, frame := range matching {
			addresses[index] = frame.pc
		}
		locations, err := symbolize(file.path, addresses)
		if err != nil {
			return "", 0, fmt.Errorf("symbolize %s: %w", key, err)
		}
		if len(locations) != len(matching) {
			return "", 0, fmt.Errorf("symbolize %s: got %d results for %d addresses", key, len(locations), len(matching))
		}
		for index, frame := range matching {
			notes[frame.line] = describeLocations(locations[index])
		}
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
		indent := frameIndent(line)
		for _, note := range notes[index] {
			output.WriteString(indent + note + "\n")
		}
	}
	return output.String(), len(frames), nil
}

func describeSymbolKey(frame nativeFrame) string {
	if frame.abi == "" {
		return frame.library + " (unknown ABI, pass --abi)"
	}
	return frame.abi + "/" + frame.library
}

func frameIndent(line string) string {
	start := strings.Index(line, "#")
	if start < 0 {
		return "    "
	}
	return strings.Repeat(" ", start+4)
}

func describeLocations(locations []sourceLocation) []string {
	if len(locations) == 0 {
		return []string{"no source location"}
	}
	described := make([]string, len(locations))
	for index, location := range locations {
		function := location.function
		if function == "" {
			function = "??"
		}
		place := function
		if location.file != "" {
			place += " at " + trimBuildRoot(location.file)
			if location.line > 0 {
				place += ":" + strconv.Itoa(location.line)
				if location.column > 0 {
					place += ":" + strconv.Itoa(location.column)
				}
			}
		}
		if index > 0 {
			place = "(inlined by) " + place
		}
		described[index] = place
	}
	return described
}

func trimBuildRoot(file string) string {
	slashed := filepath.ToSlash(file)
	if index := strings.LastIndex(slashed, "/packages/loader/"); index >= 0 {
		return slashed[index+1:]
	}
	return file
}

func parseNativeFrames(lines []string, defaultABI string) []nativeFrame {
	abi := defaultABI
	if abi == "" {
		for _, line := range lines {
			if match := tombstoneABIPattern.FindStringSubmatch(line); match != nil {
				abi = tombstoneABIs[match[1]]
				break
			}
		}
	}
	var frames []nativeFrame
	for index, line := range lines {
		match := nativeFramePattern.FindStringSubmatch(line)
		if match == nil {
			continue
		}
		library := frameLibraryName(match[3])
		if !loaderLibraryName.MatchString(library) {
			continue
		}
		pc, err := strconv.ParseUint(match[2], 16, 64)
		if err != nil {
			continue
		}
		frame := nativeFrame{line: index, pc: pc, abi: abi, library: library}
		if pathABI := frameABI(match[3]); pathABI != "" && defaultABI == "" {
			frame.abi = pathABI
		}
		if buildID := frameBuildIDPattern.FindStringSubmatch(line); buildID != nil {
			frame.buildID = strings.ToLower(buildID[1])
		}
		frames = append(frames, frame)
	}
	return frames
}

func frameLibraryName(mapping string) string {
	if index := strings.LastIndex(mapping, "!"); index >= 0 {
		mapping = mapping[index+1:]
	}
	return path.Base(mapping)
}

func frameABI(mapping string) string {
	segments := strings.FieldsFunc(mapping, func(r rune) bool { return r == '/' || r == '!' })
	for index, segment := range segments {
		if segment != "lib" || index+1 >= len(segments) {
			continue
		}
		directory := segments[index+1]
		if slices.Contains(androidABIs, directory) {
			return directory
		}
		if abi, ok := tombstoneABIs[directory]; ok {
			return abi
		}
	}
	return ""
}

func groupFramesBySymbolFile(frames []nativeFrame) [][]nativeFrame {
	groups := map[string][]nativeFrame{}
	var order []string
	for _, frame := range frames {
		key := frame.abi + "/" + frame.library
		if _, ok := groups[key]; !ok {
			order = append(order, key)
		}
		groups[key] = append(groups[key], frame)
	}
	result := make([][]nativeFrame, len(order))
	for index, key := range order {
		result[index] = groups[key]
	}
	return result
}

func openSymbolDirectory(source string) (string, func(), error) {
	info, err := os.Stat(source)
	if err != nil {
		return "", nil, err
	}
	if info.IsDir() {
		return source, func() {}, nil
	}
	directory, err := os.MkdirTemp("", "astral-android-symbols-")
	if err != nil {
		return "", nil, err
	}
	cleanup := func() { os.RemoveAll(directory) }
	if err := extractSymbolArchive(source, directory); err != nil {
		cleanup()
		return "", nil, err
	}
	return directory, cleanup, nil
}

func extractSymbolArchive(archive, directory string) error {
	reader, err := zip.OpenReader(archive)
	if err != nil {
		return fmt.Errorf("open %s: %w", archive, err)
	}
	defer reader.Close()
	for _, entry := range reader.File {
		if entry.FileInfo().IsDir() {
			continue
		}
		name := filepath.Clean(filepath.FromSlash(entry.Name))
		if filepath.IsAbs(name) || name == ".." || strings.HasPrefix(name, ".."+string(filepath.Separator)) {
			return fmt.Errorf("%s has an entry outside the archive: %s", archive, entry.Name)
		}
		destination := filepath.Join(directory, name)
		if err := os.MkdirAll(filepath.Dir(destination), 0o755); err != nil {
			return err
		}
		if err := extractZipEntry(entry, destination); err != nil {
			return err
		}
	}
	return nil
}

func extractZipEntry(entry *zip.File, destination string) error {
	source, err := entry.Open()
	if err != nil {
		return err
	}
	defer source.Close()
	target, err := os.Create(destination)
	if err != nil {
		return err
	}
	if _, err := io.Copy(target, source); err != nil {
		target.Close()
		return err
	}
	return target.Close()
}

func loadSymbolFiles(directory string) (map[string]symbolFile, error) {
	files := map[string]symbolFile{}
	err := filepath.WalkDir(directory, func(file string, entry os.DirEntry, err error) error {
		if err != nil || entry.IsDir() {
			return err
		}
		abi := filepath.Base(filepath.Dir(file))
		library := strings.TrimSuffix(entry.Name(), ".dbg")
		if !slices.Contains(androidABIs, abi) || !loaderLibraryName.MatchString(library) {
			return nil
		}
		key := abi + "/" + library
		if existing, ok := files[key]; ok && !strings.HasSuffix(existing.path, ".dbg") {
			return nil
		}
		buildID, err := elfBuildID(file)
		if err != nil {
			return fmt.Errorf("%s: %w", file, err)
		}
		files[key] = symbolFile{path: file, buildID: buildID}
		return nil
	})
	if err != nil {
		return nil, err
	}
	if len(files) == 0 {
		return nil, fmt.Errorf("%s has no <abi>/libastral.so or <abi>/libastral.so.dbg symbols", directory)
	}
	return files, nil
}

func elfBuildID(file string) (string, error) {
	object, err := elf.Open(file)
	if err != nil {
		return "", err
	}
	defer object.Close()
	for _, section := range object.Sections {
		if section.Type != elf.SHT_NOTE {
			continue
		}
		data, err := section.Data()
		if err != nil {
			continue
		}
		if id := gnuBuildIDNote(data, object.ByteOrder); id != "" {
			return id, nil
		}
	}
	return "", nil
}

func gnuBuildIDNote(data []byte, order binary.ByteOrder) string {
	for len(data) >= 12 {
		nameSize := int(order.Uint32(data[0:4]))
		descriptionSize := int(order.Uint32(data[4:8]))
		noteType := order.Uint32(data[8:12])
		nameEnd := 12 + alignNote(nameSize)
		descriptionEnd := nameEnd + alignNote(descriptionSize)
		if nameEnd > len(data) || nameEnd+descriptionSize > len(data) {
			return ""
		}
		name := bytes.TrimRight(data[12:12+nameSize], "\x00")
		if noteType == gnuBuildIDNoteType && string(name) == "GNU" {
			return hex.EncodeToString(data[nameEnd : nameEnd+descriptionSize])
		}
		if descriptionEnd > len(data) {
			return ""
		}
		data = data[descriptionEnd:]
	}
	return ""
}

func alignNote(size int) int {
	return (size + 3) &^ 3
}

func findLLVMSymbolizer(explicit string) (string, error) {
	if explicit != "" {
		return explicit, nil
	}
	executable := "llvm-symbolizer"
	if runtime.GOOS == "windows" {
		executable += ".exe"
	}
	for _, ndk := range androidNDKCandidates() {
		matches, _ := filepath.Glob(filepath.Join(ndk, "toolchains", "llvm", "prebuilt", "*", "bin", executable))
		if len(matches) > 0 {
			return matches[0], nil
		}
	}
	if found, err := exec.LookPath(executable); err == nil {
		return found, nil
	}
	return "", errors.New("llvm-symbolizer not found: install the Android NDK, set ANDROID_NDK_HOME, or pass --symbolizer")
}

func androidNDKCandidates() []string {
	var candidates []string
	for _, variable := range []string{"ANDROID_NDK_HOME", "ANDROID_NDK_ROOT", "ANDROID_NDK"} {
		if value := os.Getenv(variable); value != "" {
			candidates = append(candidates, value)
		}
	}
	var sdks []string
	for _, variable := range []string{"ANDROID_HOME", "ANDROID_SDK_ROOT"} {
		if value := os.Getenv(variable); value != "" {
			sdks = append(sdks, value)
		}
	}
	if home, err := os.UserHomeDir(); err == nil {
		sdks = append(sdks, filepath.Join(home, "Library", "Android", "sdk"), filepath.Join(home, "Android", "Sdk"))
	}
	for _, sdk := range sdks {
		versions, _ := filepath.Glob(filepath.Join(sdk, "ndk", "*"))
		sort.Sort(sort.Reverse(sort.StringSlice(versions)))
		candidates = append(candidates, versions...)
	}
	return candidates
}

type llvmSymbolizerResult struct {
	Symbol []struct {
		FunctionName string `json:"FunctionName"`
		FileName     string `json:"FileName"`
		Line         int    `json:"Line"`
		Column       int    `json:"Column"`
	} `json:"Symbol"`
	Error *struct {
		Message string `json:"Message"`
	} `json:"Error"`
}

func llvmSymbolizer(binaryPath string) symbolizeFunc {
	return func(object string, addresses []uint64) ([][]sourceLocation, error) {
		arguments := []string{"--output-style=JSON", "--demangle", "--inlines", "--obj=" + object}
		for _, address := range addresses {
			arguments = append(arguments, fmt.Sprintf("0x%x", address))
		}
		command := exec.Command(binaryPath, arguments...)
		var stderr bytes.Buffer
		command.Stderr = &stderr
		output, err := command.Output()
		if err != nil {
			return nil, fmt.Errorf("%v: %s", err, strings.TrimSpace(stderr.String()))
		}
		return parseLLVMSymbolizerOutput(output)
	}
}

func parseLLVMSymbolizerOutput(output []byte) ([][]sourceLocation, error) {
	var results []llvmSymbolizerResult
	if err := json.Unmarshal(output, &results); err != nil {
		results = nil
		scanner := bufio.NewScanner(bytes.NewReader(output))
		scanner.Buffer(make([]byte, 0, 64*1024), 16*1024*1024)
		for scanner.Scan() {
			line := bytes.TrimSpace(scanner.Bytes())
			if len(line) == 0 {
				continue
			}
			var result llvmSymbolizerResult
			if err := json.Unmarshal(line, &result); err != nil {
				return nil, fmt.Errorf("unreadable llvm-symbolizer output: %w", err)
			}
			results = append(results, result)
		}
		if err := scanner.Err(); err != nil {
			return nil, err
		}
	}
	locations := make([][]sourceLocation, len(results))
	for index, result := range results {
		if result.Error != nil {
			return nil, errors.New(result.Error.Message)
		}
		for _, symbol := range result.Symbol {
			if symbol.FunctionName == "" && symbol.FileName == "" {
				continue
			}
			locations[index] = append(locations[index], sourceLocation{
				function: symbol.FunctionName,
				file:     symbol.FileName,
				line:     symbol.Line,
				column:   symbol.Column,
			})
		}
	}
	return locations, nil
}
