package main

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"os"
	"path/filepath"
	"testing"
)

const elfCanonicalDigest = "29d2713b315ef31b19e1cebfa5f0b4c5b9a793b91b2df7e62f51437009b61c17"

func testELF() []byte {
	data := make([]byte, 1024)
	copy(data, []byte{0x7f, 'E', 'L', 'F', 2, 1})
	binary.LittleEndian.PutUint16(data[18:], 183)
	binary.LittleEndian.PutUint64(data[40:], 512)
	binary.LittleEndian.PutUint16(data[58:], 64)
	binary.LittleEndian.PutUint16(data[60:], 3)
	binary.LittleEndian.PutUint16(data[62:], 2)
	names := []byte("\x00.unbound.attestation\x00.shstrtab\x00")
	copy(data[400:], names)
	binary.LittleEndian.PutUint32(data[512+64:], 1)
	binary.LittleEndian.PutUint64(data[512+64+24:], 128)
	binary.LittleEndian.PutUint64(data[512+64+32:], sectionSize)
	binary.LittleEndian.PutUint32(data[512+128:], 22)
	binary.LittleEndian.PutUint64(data[512+128+24:], 400)
	binary.LittleEndian.PutUint64(data[512+128+32:], uint64(len(names)))
	copy(data[900:], "code!")
	return data
}

func withRecord(data []byte) []byte {
	record := append([]byte(nil), data...)
	binary.LittleEndian.PutUint32(record[128:], attestationMagic)
	binary.LittleEndian.PutUint16(record[132:], attestationVersion)
	binary.LittleEndian.PutUint16(record[134:], attestationAlgorithm)
	binary.LittleEndian.PutUint32(record[136:], sectionSize)
	binary.LittleEndian.PutUint32(record[140:], attestationKeyID)
	binary.LittleEndian.PutUint32(record[144:], 183)
	copy(record[128+156:], "abc1234")
	return record
}

func TestELFCanonicalDigestMatchesCore(t *testing.T) {
	canonical, info, err := canonicalSlice(withRecord(testELF()))
	if err != nil {
		t.Fatal(err)
	}
	if info.section.offset != 128 || info.cpuType != 183 {
		t.Fatalf("unexpected layout: %#v", info)
	}
	digest := sha256.Sum256(canonical)
	if hex.EncodeToString(digest[:]) != elfCanonicalDigest {
		t.Fatalf("canonical digest %x", digest)
	}
}

func TestSignAndVerifyELF(t *testing.T) {
	private, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	directory := t.TempDir()
	path := filepath.Join(directory, "arm64-v8a", "libunbound.so")
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, testELF(), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := signFile(path, private, "abc1234", "1.0.0"); err != nil {
		t.Fatal(err)
	}
	results, err := verifyFile(path, &private.PublicKey)
	if err != nil {
		t.Fatal(err)
	}
	if len(results) != 1 || results[0]["cpuType"] != int32(183) || results[0]["packageVersion"] != "1.0.0" {
		t.Fatalf("unexpected result: %#v", results)
	}
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	data[900] ^= 1
	if err := os.WriteFile(path, data, 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := verifyFile(path, &private.PublicKey); err == nil {
		t.Fatal("expected tamper failure")
	}
}

func TestELFWithoutAttestationSectionIsRejected(t *testing.T) {
	data := testELF()
	data[401] = 'x'
	if _, err := parseELF(data); err == nil {
		t.Fatal("expected a missing section error")
	}
}
