package main

import (
	"archive/zip"
	"bytes"
	"debug/elf"
	"encoding/binary"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestCheckAPKPageAlignmentAcceptsSixteenKilobyteSegments(t *testing.T) {
	apk := writeLibraryAPK(t, map[string][]byte{
		"lib/arm64-v8a/libunbound.so": loadSegmentELF(t, androidPageSize),
		"lib/x86_64/libunbound.so":    loadSegmentELF(t, 64*1024),
	})
	checked, err := checkAPKPageAlignment(apk)
	if err != nil || checked != 2 {
		t.Fatalf("checkAPKPageAlignment = %d, %v", checked, err)
	}
}

func TestCheckAPKPageAlignmentNamesFourKilobyteLibraries(t *testing.T) {
	apk := writeLibraryAPK(t, map[string][]byte{
		"lib/arm64-v8a/libunbound.so": loadSegmentELF(t, 4096),
		"lib/x86_64/libunbound.so":    loadSegmentELF(t, androidPageSize),
	})
	_, err := checkAPKPageAlignment(apk)
	if err == nil || !strings.Contains(err.Error(), "lib/arm64-v8a/libunbound.so") || strings.Contains(err.Error(), "x86_64") {
		t.Fatalf("checkAPKPageAlignment error = %v", err)
	}
}

func TestCheckAPKPageAlignmentRejectsAPKsWithoutLibraries(t *testing.T) {
	apk := writeLibraryAPK(t, map[string][]byte{"classes.dex": []byte("dex")})
	if _, err := checkAPKPageAlignment(apk); err == nil {
		t.Fatal("an APK without native libraries passed")
	}
}

func writeLibraryAPK(t *testing.T, entries map[string][]byte) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "module.apk")
	file, err := os.Create(path)
	if err != nil {
		t.Fatal(err)
	}
	writer := zip.NewWriter(file)
	for name, data := range entries {
		entry, err := writer.Create(name)
		if err != nil {
			t.Fatal(err)
		}
		entry.Write(data)
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	file.Close()
	return path
}

func loadSegmentELF(t *testing.T, align uint64) []byte {
	t.Helper()
	headerSize := binary.Size(elf.Header64{})
	programSize := binary.Size(elf.Prog64{})
	header := elf.Header64{
		Type:      uint16(elf.ET_DYN),
		Machine:   uint16(elf.EM_AARCH64),
		Version:   uint32(elf.EV_CURRENT),
		Phoff:     uint64(headerSize),
		Ehsize:    uint16(headerSize),
		Phentsize: uint16(programSize),
		Phnum:     1,
	}
	copy(header.Ident[:], elf.ELFMAG)
	header.Ident[elf.EI_CLASS] = byte(elf.ELFCLASS64)
	header.Ident[elf.EI_DATA] = byte(elf.ELFDATA2LSB)
	header.Ident[elf.EI_VERSION] = byte(elf.EV_CURRENT)
	program := elf.Prog64{Type: uint32(elf.PT_LOAD), Flags: uint32(elf.PF_R), Filesz: 64, Memsz: 64, Align: align}
	var file bytes.Buffer
	binary.Write(&file, binary.LittleEndian, header)
	binary.Write(&file, binary.LittleEndian, program)
	return file.Bytes()
}
