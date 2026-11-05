package main

import (
	"bytes"
	"compress/flate"
	"encoding/binary"
	"errors"
	"flag"
	"fmt"
	"hash/crc32"
	"io"
	"os"
)

// patchedAPKVersionCode is shared by every patched build, so Android installs any build over any other, upgrade or downgrade.
const patchedAPKVersionCode = 2_000_000_000

const (
	zipLocalHeaderSignature   = 0x04034b50
	zipCentralHeaderSignature = 0x02014b50
	zipEndSignature           = 0x06054b50
	zipEndSize                = 22
	zipDataDescriptorFlag     = 0x8
	zipDeflated               = 8
	zipStored                 = 0
)

func runPatchAPK(args []string) error {
	set := flag.NewFlagSet("patch-apk", flag.ContinueOnError)
	signerPath := set.String("signer", "", "PEM file with the signing private key and its certificate")
	if err := set.Parse(args); err != nil {
		return err
	}
	if *signerPath == "" || set.NArg() == 0 {
		return errors.New("usage: patch-apk --signer <pem> <apk>...")
	}
	signer, err := readAPKSigner(*signerPath)
	if err != nil {
		return err
	}
	for _, path := range set.Args() {
		if err := patchAPK(path, patchedAPKVersionCode, signer); err != nil {
			return fmt.Errorf("Failed to patch APK %s: %w", path, err)
		}
		fmt.Println("patched", path)
	}
	return nil
}

// patchAPK rewrites the APK at path in place: it pins the manifest's versionCode, lets the base request package installs, and re-signs with APK Signature Scheme v2.
// Every other entry keeps its bytes and offset, so LSPatch's entries that share bytes with its stored origin.apk stay shared.
func patchAPK(path string, versionCode uint32, signer apkSigner) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	layout, err := readZipLayout(data)
	if err != nil {
		return err
	}
	record, err := layout.centralRecord("AndroidManifest.xml")
	if err != nil {
		return err
	}
	manifest, err := readZipRecordData(data, record)
	if err != nil {
		return err
	}
	identity, err := parseBinaryManifest(manifest)
	if err != nil {
		return err
	}
	permission := ""
	if identity.Split == "" {
		permission = requestInstallPackages
	}
	manifest, err = patchBinaryManifest(manifest, versionCode, permission)
	if err != nil {
		return err
	}

	entries := append([]byte(nil), data[:layout.entriesEnd]...)
	centralDirectory := append([]byte(nil), data[layout.centralDirectory:layout.end]...)
	end := append([]byte(nil), data[layout.end:]...)
	local, err := zipLocalEntry(data, record, manifest)
	if err != nil {
		return err
	}
	header := centralDirectory[record.offset-layout.centralDirectory:]
	binary.LittleEndian.PutUint16(header[8:], binary.LittleEndian.Uint16(local[6:]))
	copy(header[10:12], local[8:10])
	copy(header[16:28], local[14:26])
	binary.LittleEndian.PutUint32(header[42:], uint32(len(entries)))
	entries = append(entries, local...)
	if uint64(len(entries)) > 0xffffffff {
		return errors.New("the patched APK needs ZIP64")
	}

	block, err := apkSigningBlock(signer, entries, centralDirectory, end)
	if err != nil {
		return err
	}
	binary.LittleEndian.PutUint32(end[16:], uint32(len(entries)+len(block)))
	partial := path + ".partial"
	output := concatBytes(entries, block, centralDirectory, end)
	if err := os.WriteFile(partial, output, 0o644); err != nil {
		return err
	}
	return os.Rename(partial, path)
}

type zipLayout struct {
	entriesEnd       int
	centralDirectory int
	end              int
	records          []zipCentralRecord
}

type zipCentralRecord struct {
	name   string
	offset int
}

func readZipLayout(data []byte) (zipLayout, error) {
	end := -1
	for position := len(data) - zipEndSize; position >= 0 && position >= len(data)-zipEndSize-0xffff; position-- {
		if binary.LittleEndian.Uint32(data[position:]) == zipEndSignature && position+zipEndSize+int(binary.LittleEndian.Uint16(data[position+20:])) == len(data) {
			end = position
			break
		}
	}
	if end < 0 {
		return zipLayout{}, errors.New("the APK has no ZIP end record")
	}
	count := int(binary.LittleEndian.Uint16(data[end+10:]))
	size := int(binary.LittleEndian.Uint32(data[end+12:]))
	start := int(binary.LittleEndian.Uint32(data[end+16:]))
	if start == 0xffffffff || count == 0xffff {
		return zipLayout{}, errors.New("ZIP64 APKs are not supported")
	}
	if start+size != end {
		return zipLayout{}, errors.New("the APK's central directory does not end at its end record")
	}
	layout := zipLayout{entriesEnd: start, centralDirectory: start, end: end}
	if block := apkSigningBlockStart(data, start); block >= 0 {
		layout.entriesEnd = block
	}
	for position := start; position < end; {
		if position+46 > end || binary.LittleEndian.Uint32(data[position:]) != zipCentralHeaderSignature {
			return zipLayout{}, fmt.Errorf("malformed central directory record at %d", position)
		}
		nameLength := int(binary.LittleEndian.Uint16(data[position+28:]))
		extraLength := int(binary.LittleEndian.Uint16(data[position+30:]))
		commentLength := int(binary.LittleEndian.Uint16(data[position+32:]))
		layout.records = append(layout.records, zipCentralRecord{name: string(data[position+46 : position+46+nameLength]), offset: position})
		position += 46 + nameLength + extraLength + commentLength
	}
	return layout, nil
}

// apkSigningBlockStart returns where the APK Signing Block before centralDirectory starts, or -1 when the APK has none.
func apkSigningBlockStart(data []byte, centralDirectory int) int {
	if centralDirectory < 32 || string(data[centralDirectory-16:centralDirectory]) != apkSigningBlockMagic {
		return -1
	}
	size := binary.LittleEndian.Uint64(data[centralDirectory-24:])
	start := centralDirectory - int(size) - 8
	if size > uint64(centralDirectory) || start < 0 || binary.LittleEndian.Uint64(data[start:]) != size {
		return -1
	}
	return start
}

func (layout zipLayout) centralRecord(name string) (zipCentralRecord, error) {
	for _, record := range layout.records {
		if record.name == name {
			return record, nil
		}
	}
	return zipCentralRecord{}, fmt.Errorf("the APK has no %s", name)
}

func readZipRecordData(data []byte, record zipCentralRecord) ([]byte, error) {
	header := data[record.offset:]
	method := binary.LittleEndian.Uint16(header[10:])
	compressedSize := int(binary.LittleEndian.Uint32(header[20:]))
	local := int(binary.LittleEndian.Uint32(header[42:]))
	if local+30 > len(data) || binary.LittleEndian.Uint32(data[local:]) != zipLocalHeaderSignature {
		return nil, fmt.Errorf("malformed local header for %s", record.name)
	}
	start := local + 30 + int(binary.LittleEndian.Uint16(data[local+26:])) + int(binary.LittleEndian.Uint16(data[local+28:]))
	if start+compressedSize > len(data) {
		return nil, fmt.Errorf("%s overflows the APK", record.name)
	}
	compressed := data[start : start+compressedSize]
	switch method {
	case zipStored:
		return append([]byte(nil), compressed...), nil
	case zipDeflated:
		return io.ReadAll(flate.NewReader(bytes.NewReader(compressed)))
	}
	return nil, fmt.Errorf("%s uses unsupported compression method %d", record.name, method)
}

// zipLocalEntry returns a deflated local file entry holding content, named and timestamped like record.
func zipLocalEntry(data []byte, record zipCentralRecord, content []byte) ([]byte, error) {
	var compressed bytes.Buffer
	writer, err := flate.NewWriter(&compressed, flate.BestCompression)
	if err != nil {
		return nil, err
	}
	writer.Write(content)
	if err := writer.Close(); err != nil {
		return nil, err
	}
	header := data[record.offset:]
	local := binary.LittleEndian.AppendUint32(nil, zipLocalHeaderSignature)
	local = binary.LittleEndian.AppendUint16(local, 20)
	local = binary.LittleEndian.AppendUint16(local, binary.LittleEndian.Uint16(header[8:])&^zipDataDescriptorFlag)
	local = binary.LittleEndian.AppendUint16(local, zipDeflated)
	local = append(local, header[12:16]...)
	local = binary.LittleEndian.AppendUint32(local, crc32.ChecksumIEEE(content))
	local = binary.LittleEndian.AppendUint32(local, uint32(compressed.Len()))
	local = binary.LittleEndian.AppendUint32(local, uint32(len(content)))
	local = binary.LittleEndian.AppendUint16(local, uint16(len(record.name)))
	local = binary.LittleEndian.AppendUint16(local, 0)
	local = append(local, record.name...)
	return append(local, compressed.Bytes()...), nil
}
