package main

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"encoding/binary"
	"os"
	"path/filepath"
	"testing"
)

func TestSignAndVerifyThinMachO(t *testing.T) {
	private, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(t.TempDir(), "fixture.dylib")
	if err := os.WriteFile(path, testMachO(), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := signFile(path, private, "0123456789012345678901234567890123456789", "2.5.1"); err != nil {
		t.Fatal(err)
	}
	results, err := verifyFile(path, &private.PublicKey)
	if err != nil {
		t.Fatal(err)
	}
	if len(results) != 1 || results[0]["packageVersion"] != "2.5.1" {
		t.Fatalf("unexpected result: %#v", results)
	}
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	data[len(data)-1] ^= 1
	if err := os.WriteFile(path, data, 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := verifyFile(path, &private.PublicKey); err == nil {
		t.Fatal("expected tamper failure")
	}
}

func TestMalformedMachOIsRejected(t *testing.T) {
	if _, err := fatSlices([]byte{1, 2, 3}); err == nil {
		t.Fatal("expected malformed Mach-O error")
	}
}

func TestSignAndVerifyFatMachO(t *testing.T) {
	private, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	part := testMachO()
	fat := make([]byte, 48+len(part)*2)
	binary.BigEndian.PutUint32(fat[0:4], magicFat)
	binary.BigEndian.PutUint32(fat[4:8], 2)
	binary.BigEndian.PutUint32(fat[8:12], uint32(0x0100000c))
	binary.BigEndian.PutUint32(fat[12:16], 0)
	binary.BigEndian.PutUint32(fat[16:20], 48)
	binary.BigEndian.PutUint32(fat[20:24], uint32(len(part)))
	binary.BigEndian.PutUint32(fat[28:32], uint32(0x0100000c))
	binary.BigEndian.PutUint32(fat[32:36], 0)
	binary.BigEndian.PutUint32(fat[36:40], uint32(48+len(part)))
	binary.BigEndian.PutUint32(fat[40:44], uint32(len(part)))
	copy(fat[48:], part)
	copy(fat[48+len(part):], part)
	path := filepath.Join(t.TempDir(), "fat.dylib")
	if err := os.WriteFile(path, fat, 0o644); err != nil {
		t.Fatal(err)
	}
	if err := signFile(path, private, "commit", "version"); err != nil {
		t.Fatal(err)
	}
	results, err := verifyFile(path, &private.PublicKey)
	if err != nil {
		t.Fatal(err)
	}
	if len(results) != 2 {
		t.Fatalf("expected two verified slices, got %d", len(results))
	}
}

func testMachO() []byte {
	const headerSize = 32
	const segmentSize = 152
	const sectionOffset = headerSize + segmentSize
	data := make([]byte, sectionOffset+sectionSize)
	binary.LittleEndian.PutUint32(data[0:4], magicThin64)
	binary.LittleEndian.PutUint32(data[4:8], uint32(0x0100000c))
	binary.LittleEndian.PutUint32(data[16:20], 1)
	binary.LittleEndian.PutUint32(data[20:24], segmentSize)
	binary.LittleEndian.PutUint32(data[32:36], lcSegment64)
	binary.LittleEndian.PutUint32(data[36:40], segmentSize)
	copy(data[40:46], "__TEXT")
	binary.LittleEndian.PutUint32(data[96:100], 1)
	binary.LittleEndian.PutUint32(data[100:104], 0)
	copy(data[104:120], "__attestation")
	copy(data[120:136], "__TEXT")
	binary.LittleEndian.PutUint64(data[144:152], sectionSize)
	binary.LittleEndian.PutUint32(data[152:156], sectionOffset)
	return data
}
