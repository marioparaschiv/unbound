package main

import (
	"archive/zip"
	"bytes"
	"debug/elf"
	"encoding/binary"
	"encoding/hex"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

const sampleTombstone = `*** *** *** *** *** *** *** *** *** *** *** *** *** *** *** ***
Build fingerprint: 'google/sdk_gphone64_arm64/emu64a:15/AE3A.240806.005/12228598:user/release-keys'
ABI: 'arm64'
pid: 4242, tid: 4242, name: com.discord  >>> com.discord <<<
signal 11 (SIGSEGV), code 1 (SEGV_MAPERR), fault addr 0x0000000000000000
backtrace:
      #00 pc 000000000004f1a4  /data/app/~~a==/com.discord-b==/lib/arm64/libunbound.so (loader::start()+20) (BuildId: A1C7C43CC1F811DC2E81AEC2DF90C58FF174C113)
      #01 pc 0000000000062f00  /apex/com.android.runtime/lib64/bionic/libc.so (__start_thread+64) (BuildId: 0123)
      #02 pc 0000000000001000  /data/app/~~a==/com.discord-b==/base.apk!libunbound.so (offset 0x4000) (BuildId: a1c7c43cc1f811dc2e81aec2df90c58ff174c113)
`

const sampleLogcat = `10-26 12:00:00.000  4300  4300 F DEBUG   : ABI: 'x86_64'
10-26 12:00:00.001  4300  4300 F DEBUG   :       #00 pc 00000000000aa840  /data/user/0/com.discord/cache/lspatch/lib/x86_64/libunbound.so
`

func TestParseNativeFramesKeepsOnlyLoaderFrames(t *testing.T) {
	frames := parseNativeFrames(strings.SplitAfter(sampleTombstone, "\n"), "")
	if len(frames) != 2 {
		t.Fatalf("expected the two libunbound frames, got %+v", frames)
	}
	first, second := frames[0], frames[1]
	if first.pc != 0x4f1a4 || first.abi != "arm64-v8a" || first.library != "libunbound.so" || first.buildID != "a1c7c43cc1f811dc2e81aec2df90c58ff174c113" {
		t.Fatalf("unexpected first frame %+v", first)
	}
	if second.pc != 0x1000 || second.abi != "arm64-v8a" || second.library != "libunbound.so" {
		t.Fatalf("a frame loaded from inside the APK must resolve to the library, got %+v", second)
	}
}

func TestParseNativeFramesReadsLogcatBacktraces(t *testing.T) {
	frames := parseNativeFrames(strings.SplitAfter(sampleLogcat, "\n"), "")
	if len(frames) != 1 || frames[0].pc != 0xaa840 || frames[0].abi != "x86_64" || frames[0].buildID != "" {
		t.Fatalf("unexpected logcat frames %+v", frames)
	}
	overridden := parseNativeFrames(strings.SplitAfter(sampleLogcat, "\n"), "arm64-v8a")
	if overridden[0].abi != "arm64-v8a" {
		t.Fatalf("an explicit ABI must win, got %+v", overridden)
	}
}

func TestSymbolicateAnnotatesLoaderFrames(t *testing.T) {
	files := map[string]symbolFile{"arm64-v8a/libunbound.so": {path: "symbols/arm64-v8a/libunbound.so.dbg", buildID: "a1c7c43cc1f811dc2e81aec2df90c58ff174c113"}}
	var requested []uint64
	symbolize := func(object string, addresses []uint64) ([][]sourceLocation, error) {
		if object != "symbols/arm64-v8a/libunbound.so.dbg" {
			t.Fatalf("symbolized the wrong object %q", object)
		}
		requested = addresses
		return [][]sourceLocation{
			{
				{function: "loader::readSettings()", file: "/home/runner/work/unbound/unbound/packages/loader/core/src/Settings.cpp", line: 12, column: 3},
				{function: "loader::start()", file: "/home/runner/work/unbound/unbound/packages/loader/core/src/Loader.cpp", line: 40},
			},
			{{function: "JNI_OnLoad", file: "/ndk/sources/Entry.cpp", line: 7}},
		}, nil
	}
	output, count, err := symbolicateAndroidBacktrace(sampleTombstone, "", files, symbolize)
	if err != nil {
		t.Fatal(err)
	}
	if count != 2 || len(requested) != 2 || requested[0] != 0x4f1a4 || requested[1] != 0x1000 {
		t.Fatalf("expected both loader addresses in one call, got %d frames and %x", count, requested)
	}
	for _, expected := range []string{
		"(BuildId: A1C7C43CC1F811DC2E81AEC2DF90C58FF174C113)\n          loader::readSettings() at packages/loader/core/src/Settings.cpp:12:3\n          (inlined by) loader::start() at packages/loader/core/src/Loader.cpp:40\n",
		"(BuildId: 0123)\n      #02 pc",
		"(offset 0x4000) (BuildId: a1c7c43cc1f811dc2e81aec2df90c58ff174c113)\n          JNI_OnLoad at /ndk/sources/Entry.cpp:7\n",
	} {
		if !strings.Contains(output, expected) {
			t.Fatalf("output is missing %q:\n%s", expected, output)
		}
	}
	if !strings.HasPrefix(output, "*** *** ***") {
		t.Fatal("the backtrace must be echoed around the annotations")
	}
}

func TestSymbolicateRefusesSymbolsOfAnotherBuild(t *testing.T) {
	files := map[string]symbolFile{"arm64-v8a/libunbound.so": {path: "libunbound.so.dbg", buildID: "ffff"}}
	symbolize := func(string, []uint64) ([][]sourceLocation, error) {
		t.Fatal("symbols of another build must not be used")
		return nil, nil
	}
	output, _, err := symbolicateAndroidBacktrace(sampleTombstone, "", files, symbolize)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(output, "symbols are for build ID ffff, the crash is build ID a1c7c43cc1f811dc2e81aec2df90c58ff174c113") {
		t.Fatalf("a build ID mismatch must be reported:\n%s", output)
	}
}

func TestSymbolicateReportsMissingSymbols(t *testing.T) {
	files := map[string]symbolFile{"arm64-v8a/libunbound.so": {path: "libunbound.so.dbg"}}
	symbolize := func(string, []uint64) ([][]sourceLocation, error) {
		t.Fatal("no symbols exist for x86_64")
		return nil, nil
	}
	output, count, err := symbolicateAndroidBacktrace(sampleLogcat, "", files, symbolize)
	if err != nil {
		t.Fatal(err)
	}
	if count != 1 || !strings.Contains(output, "no symbols for x86_64/libunbound.so") {
		t.Fatalf("missing symbols must be reported, got %d frames:\n%s", count, output)
	}
}

func TestParseLLVMSymbolizerOutput(t *testing.T) {
	output := []byte(`[{"Address":"0x79da0","ModuleName":"libunbound.so.dbg","Symbol":[{"Column":5,"Discriminator":0,"FileName":"/src/Entry.cpp","FunctionName":"JNI_OnLoad","Line":437,"StartAddress":"0x79da0","StartFileName":"/src/Entry.cpp","StartLine":436}]},{"Address":"0x10","ModuleName":"libunbound.so.dbg","Symbol":[{"Column":0,"Discriminator":0,"FileName":"","FunctionName":"","Line":0,"StartAddress":"","StartFileName":"","StartLine":0}]}]`)
	locations, err := parseLLVMSymbolizerOutput(output)
	if err != nil {
		t.Fatal(err)
	}
	if len(locations) != 2 || len(locations[0]) != 1 || locations[0][0] != (sourceLocation{function: "JNI_OnLoad", file: "/src/Entry.cpp", line: 437, column: 5}) || len(locations[1]) != 0 {
		t.Fatalf("unexpected locations %+v", locations)
	}
	if described := describeLocations(locations[1]); len(described) != 1 || described[0] != "no source location" {
		t.Fatalf("an unknown address must say so, got %q", described)
	}
}

func TestLoadSymbolFilesReadsBuildIDsFromDirectoriesAndArchives(t *testing.T) {
	buildID, _ := hex.DecodeString("a1c7c43cc1f811dc2e81aec2df90c58ff174c113")
	library := buildIDOnlyELF(t, buildID)
	directory := t.TempDir()
	if err := os.MkdirAll(filepath.Join(directory, "arm64-v8a"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(directory, "arm64-v8a", "libunbound.so.dbg"), library, 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(directory, "build-ids.txt"), []byte("arm64-v8a a1c7\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	files, err := loadSymbolFiles(directory)
	if err != nil {
		t.Fatal(err)
	}
	if file := files["arm64-v8a/libunbound.so"]; len(files) != 1 || file.buildID != hex.EncodeToString(buildID) {
		t.Fatalf("unexpected symbol files %+v", files)
	}

	archive := filepath.Join(t.TempDir(), "unbound-android-symbols.zip")
	var buffer bytes.Buffer
	writer := zip.NewWriter(&buffer)
	entry, err := writer.Create("x86_64/libunbound.so")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := entry.Write(library); err != nil {
		t.Fatal(err)
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(archive, buffer.Bytes(), 0o644); err != nil {
		t.Fatal(err)
	}
	extracted, cleanup, err := openSymbolDirectory(archive)
	if err != nil {
		t.Fatal(err)
	}
	defer cleanup()
	files, err = loadSymbolFiles(extracted)
	if err != nil {
		t.Fatal(err)
	}
	if file := files["x86_64/libunbound.so"]; len(files) != 1 || file.buildID != hex.EncodeToString(buildID) {
		t.Fatalf("unexpected archived symbol files %+v", files)
	}
}

func TestLoadSymbolFilesRejectsDirectoriesWithoutSymbols(t *testing.T) {
	if _, err := loadSymbolFiles(t.TempDir()); err == nil {
		t.Fatal("an empty symbols directory must be rejected")
	}
}

func TestSymbolicateWithTheNDKSymbolizer(t *testing.T) {
	symbolizer, err := findLLVMSymbolizer("")
	if err != nil {
		t.Skip("the Android NDK is not installed")
	}
	clang := filepath.Join(filepath.Dir(symbolizer), "clang")
	if runtime.GOOS == "windows" {
		clang += ".exe"
	}
	if _, err := os.Stat(clang); err != nil {
		t.Skip("the Android NDK has no clang next to llvm-symbolizer")
	}
	directory := t.TempDir()
	source := filepath.Join(directory, "crash.c")
	if err := os.WriteFile(source, []byte("int unbound_crash(int *value) {\n\treturn *value + 1;\n}\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	library := filepath.Join(directory, "symbols", "arm64-v8a", "libunbound.so")
	if err := os.MkdirAll(filepath.Dir(library), 0o755); err != nil {
		t.Fatal(err)
	}
	build := exec.Command(clang, "--target=aarch64-linux-android28", "-g", "-O0", "-shared", "-fPIC", "-Wl,--build-id=sha1", "-o", library, source)
	if output, err := build.CombinedOutput(); err != nil {
		t.Fatalf("compile a test library: %v\n%s", err, output)
	}
	address := elfSymbolAddress(t, library, "unbound_crash")
	files, err := loadSymbolFiles(filepath.Join(directory, "symbols"))
	if err != nil {
		t.Fatal(err)
	}
	backtrace := fmt.Sprintf("ABI: 'arm64'\n      #00 pc %016x  /data/app/lib/arm64/libunbound.so (BuildId: %s)\n", address, files["arm64-v8a/libunbound.so"].buildID)
	output, count, err := symbolicateAndroidBacktrace(backtrace, "", files, llvmSymbolizer(symbolizer))
	if err != nil {
		t.Fatal(err)
	}
	if count != 1 || !strings.Contains(output, "unbound_crash at "+source+":1") {
		t.Fatalf("the NDK symbolizer must resolve the crash frame:\n%s", output)
	}
}

func elfSymbolAddress(t *testing.T, library, name string) uint64 {
	t.Helper()
	object, err := elf.Open(library)
	if err != nil {
		t.Fatal(err)
	}
	defer object.Close()
	symbols, err := object.Symbols()
	if err != nil {
		t.Fatal(err)
	}
	for _, symbol := range symbols {
		if symbol.Name == name {
			return symbol.Value
		}
	}
	t.Fatalf("%s has no %s symbol", library, name)
	return 0
}

func buildIDOnlyELF(t *testing.T, buildID []byte) []byte {
	t.Helper()
	var note bytes.Buffer
	for _, value := range []uint32{4, uint32(len(buildID)), gnuBuildIDNoteType} {
		binary.Write(&note, binary.LittleEndian, value)
	}
	note.WriteString("GNU\x00")
	note.Write(buildID)
	for note.Len()%4 != 0 {
		note.WriteByte(0)
	}
	names := []byte("\x00.note.gnu.build-id\x00.shstrtab\x00")
	headerSize := binary.Size(elf.Header64{})
	sectionSize := binary.Size(elf.Section64{})
	noteOffset := uint64(headerSize)
	namesOffset := noteOffset + uint64(note.Len())
	sectionsOffset := (namesOffset + uint64(len(names)) + 7) &^ 7
	header := elf.Header64{
		Type:      uint16(elf.ET_DYN),
		Machine:   uint16(elf.EM_AARCH64),
		Version:   uint32(elf.EV_CURRENT),
		Shoff:     sectionsOffset,
		Ehsize:    uint16(headerSize),
		Shentsize: uint16(sectionSize),
		Shnum:     3,
		Shstrndx:  2,
	}
	copy(header.Ident[:], elf.ELFMAG)
	header.Ident[elf.EI_CLASS] = byte(elf.ELFCLASS64)
	header.Ident[elf.EI_DATA] = byte(elf.ELFDATA2LSB)
	header.Ident[elf.EI_VERSION] = byte(elf.EV_CURRENT)
	sections := []elf.Section64{
		{},
		{Name: 1, Type: uint32(elf.SHT_NOTE), Flags: uint64(elf.SHF_ALLOC), Off: noteOffset, Size: uint64(note.Len()), Addralign: 4},
		{Name: 20, Type: uint32(elf.SHT_STRTAB), Off: namesOffset, Size: uint64(len(names)), Addralign: 1},
	}
	var file bytes.Buffer
	binary.Write(&file, binary.LittleEndian, header)
	file.Write(note.Bytes())
	file.Write(names)
	for uint64(file.Len()) < sectionsOffset {
		file.WriteByte(0)
	}
	for _, section := range sections {
		binary.Write(&file, binary.LittleEndian, section)
	}
	return file.Bytes()
}
