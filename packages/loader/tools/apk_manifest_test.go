package main

import (
	"bytes"
	"encoding/binary"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"unicode/utf16"
)

type testManifestAttribute struct {
	name  string
	kind  uint8
	value string
	data  uint32
}

func encodeTestStringPool(values []string) []byte {
	var data bytes.Buffer
	offsets := make([]uint32, len(values))
	for index, value := range values {
		offsets[index] = uint32(data.Len())
		units := utf16.Encode([]rune(value))
		binary.Write(&data, binary.LittleEndian, uint16(len(units)))
		binary.Write(&data, binary.LittleEndian, units)
		binary.Write(&data, binary.LittleEndian, uint16(0))
	}
	for data.Len()%4 != 0 {
		data.WriteByte(0)
	}
	headerSize := 28
	start := headerSize + 4*len(values)
	var chunk bytes.Buffer
	binary.Write(&chunk, binary.LittleEndian, []uint16{binaryXMLStringPool, uint16(headerSize)})
	binary.Write(&chunk, binary.LittleEndian, []uint32{uint32(start + data.Len()), uint32(len(values)), 0, 0, uint32(start), 0})
	binary.Write(&chunk, binary.LittleEndian, offsets)
	chunk.Write(data.Bytes())
	return chunk.Bytes()
}

func encodeTestManifest(attributes []testManifestAttribute, stripNames bool) []byte {
	pool := []string{"versionCode", "versionName"}
	if stripNames {
		pool = []string{"", ""}
	}
	index := func(value string) uint32 {
		for position, existing := range pool {
			if existing == value && (position > 1 || !stripNames) {
				return uint32(position)
			}
		}
		pool = append(pool, value)
		return uint32(len(pool) - 1)
	}
	element := index("manifest")
	type encoded struct{ name, raw, data uint32 }
	var entries []encoded
	var kinds []uint8
	for _, attribute := range attributes {
		name := index(attribute.name)
		if stripNames && attribute.name == "versionCode" {
			name = 0
		}
		if stripNames && attribute.name == "versionName" {
			name = 1
		}
		raw, data := uint32(binaryXMLNoIndex), attribute.data
		if attribute.kind == binaryXMLStringValue {
			raw = index(attribute.value)
			data = raw
		}
		entries = append(entries, encoded{name: name, raw: raw, data: data})
		kinds = append(kinds, attribute.kind)
	}
	stringPool := encodeTestStringPool(pool)
	var resources bytes.Buffer
	binary.Write(&resources, binary.LittleEndian, []uint16{binaryXMLResourceMap, 8})
	binary.Write(&resources, binary.LittleEndian, []uint32{16, androidVersionCodeAttr, androidVersionNameAttr})
	var start bytes.Buffer
	size := 16 + 20 + 20*len(entries)
	binary.Write(&start, binary.LittleEndian, []uint16{binaryXMLStartElement, 16})
	binary.Write(&start, binary.LittleEndian, []uint32{uint32(size), 1, binaryXMLNoIndex, binaryXMLNoIndex, element})
	binary.Write(&start, binary.LittleEndian, []uint16{20, 20, uint16(len(entries)), 0, 0, 0})
	for position, entry := range entries {
		binary.Write(&start, binary.LittleEndian, []uint32{binaryXMLNoIndex, entry.name, entry.raw})
		binary.Write(&start, binary.LittleEndian, []uint16{8})
		start.Write([]byte{0, kinds[position]})
		binary.Write(&start, binary.LittleEndian, entry.data)
	}
	body := append(append(stringPool, resources.Bytes()...), start.Bytes()...)
	var document bytes.Buffer
	binary.Write(&document, binary.LittleEndian, []uint16{binaryXMLDocument, 8})
	binary.Write(&document, binary.LittleEndian, uint32(8+len(body)))
	document.Write(body)
	return document.Bytes()
}

func discordTestManifest(code int, versionName, split string) []byte {
	attributes := []testManifestAttribute{
		{name: "versionCode", kind: binaryXMLDecimalValue, data: uint32(code)},
		{name: "versionName", kind: binaryXMLStringValue, value: versionName},
		{name: "package", kind: binaryXMLStringValue, value: discordAndroidPackage},
	}
	if split != "" {
		attributes = append(attributes, testManifestAttribute{name: "split", kind: binaryXMLStringValue, value: split})
	}
	return encodeTestManifest(attributes, false)
}

func writeTestAPK(t *testing.T, path string, manifest []byte) {
	t.Helper()
	if err := os.WriteFile(path, testAPKBytes(t, manifest), 0o644); err != nil {
		t.Fatal(err)
	}
}

func TestParseBinaryManifestReadsDiscordIdentity(t *testing.T) {
	manifest, err := parseBinaryManifest(discordTestManifest(351112, "351.12 - Beta", "config.arm64_v8a"))
	if err != nil {
		t.Fatal(err)
	}
	want := apkManifest{Package: "com.discord", VersionCode: 351112, VersionName: "351.12 - Beta", Split: "config.arm64_v8a"}
	if manifest != want {
		t.Fatalf("parsed %+v, want %+v", manifest, want)
	}
}

func TestParseBinaryManifestFindsVersionThroughResourceIDs(t *testing.T) {
	data := encodeTestManifest([]testManifestAttribute{
		{name: "versionCode", kind: binaryXMLHexValue, data: 352208},
		{name: "versionName", kind: binaryXMLStringValue, value: "352.8 - Alpha"},
		{name: "package", kind: binaryXMLStringValue, value: "com.discord"},
	}, true)
	manifest, err := parseBinaryManifest(data)
	if err != nil {
		t.Fatal(err)
	}
	if manifest.VersionCode != 352208 || manifest.VersionName != "352.8 - Alpha" || manifest.Package != "com.discord" {
		t.Fatalf("parsed %+v from a manifest with stripped attribute names", manifest)
	}
}

func TestParseBinaryManifestRejectsOtherDocuments(t *testing.T) {
	for name, data := range map[string][]byte{
		"text XML":     []byte("<manifest package=\"com.discord\"/>"),
		"truncated":    discordTestManifest(350008, "350.8 - Stable", "")[:40],
		"empty buffer": {},
	} {
		if _, err := parseBinaryManifest(data); err == nil {
			t.Fatalf("%s was accepted as a manifest", name)
		}
	}
}

func TestVerifyDiscordSplitChecksPackageAndVersionCode(t *testing.T) {
	directory := t.TempDir()
	matching := filepath.Join(directory, "base.apk")
	writeTestAPK(t, matching, discordTestManifest(350008, "350.8 - Stable", ""))
	if manifest, err := verifyDiscordSplit(matching, 350008); err != nil || manifest.VersionName != "350.8 - Stable" {
		t.Fatalf("matching APK failed verification: %+v %v", manifest, err)
	}
	if _, err := verifyDiscordSplit(matching, 351112); err == nil || !strings.Contains(err.Error(), "version code 350008") {
		t.Fatalf("a mismatched version code was accepted: %v", err)
	}
	other := filepath.Join(directory, "other.apk")
	writeTestAPK(t, other, encodeTestManifest([]testManifestAttribute{
		{name: "versionCode", kind: binaryXMLDecimalValue, data: 350008},
		{name: "package", kind: binaryXMLStringValue, value: "com.example"},
	}, false))
	if _, err := verifyDiscordSplit(other, 350008); err == nil || !strings.Contains(err.Error(), "com.example") {
		t.Fatalf("an APK for another package was accepted: %v", err)
	}
}
