package main

import (
	"bytes"
	"crypto/ecdsa"
	"crypto/rand"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"encoding/pem"
	"errors"
	"flag"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

const (
	magicThin64          = uint32(0xfeedfacf)
	magicFat             = uint32(0xcafebabe)
	magicFat64           = uint32(0xcafebabf)
	magicFatSwapped      = uint32(0xbebafeca)
	magicFat64Swapped    = uint32(0xbfbafeca)
	lcSegment64          = uint32(0x19)
	lcCodeSignature      = uint32(0x1d)
	attestationMagic     = uint32(0x41545453)
	attestationVersion   = uint16(1)
	attestationAlgorithm = uint16(1)
	attestationKeyID     = uint32(0x3ce00b70)
	sectionSize          = 256
	signatureCapacity    = 96
	elfSectionName       = ".astral.attestation"
)

type AttestationError struct {
	Message string
}

func (e *AttestationError) Error() string { return e.Message }

type machoSection struct {
	offset uint64
	size   uint64
}

type codeSignature struct {
	commandOffset int
	offset        uint32
	size          uint32
}

type machoInfo struct {
	cpuType          int32
	cpuSubtype       int32
	section          machoSection
	codeSignature    *codeSignature
	linkeditVMSize   int
	linkeditFileSize int
	boundary         int
}

type machoSlice struct {
	offset     int
	size       int
	cpuType    int32
	cpuSubtype int32
}

type attestation struct {
	magic           uint32
	version         uint16
	algorithm       uint16
	size            uint32
	keyID           uint32
	cpuType         int32
	cpuSubtype      int32
	digest          [32]byte
	signatureLength uint16
	signature       []byte
	commitHash      string
	packageVersion  string
}

func runAttest(args []string) error {
	if len(args) == 0 {
		return errors.New("usage: attest <enabled|stage|stage-elf|sign|verify>")
	}
	switch args[0] {
	case "enabled":
		return attestEnabledCommand()
	case "stage":
		return attestStageCommand(args[1:])
	case "stage-elf":
		return attestStageELFCommand(args[1:])
	case "sign":
		return attestSignCommand(args[1:])
	case "verify":
		return attestVerifyCommand(args[1:])
	default:
		return fmt.Errorf("unknown attest command %q", args[0])
	}
}

func attestEnabledCommand() error {
	if os.Getenv("DEBUG") == "1" {
		fmt.Println("0")
		return nil
	}
	private, err := privateKeyBytes()
	if err != nil {
		fmt.Println("0")
		return nil
	}
	privateKey, err := parsePrivateKey(private)
	if err != nil {
		fmt.Println("0")
		return nil
	}
	expected, err := pinnedPublicKey()
	if err != nil || !publicKeysEqual(&privateKey.PublicKey, expected) {
		fmt.Println("0")
		return nil
	}
	fmt.Println("1")
	return nil
}

func attestStageCommand(args []string) error {
	set := flag.NewFlagSet("attest stage", flag.ContinueOnError)
	staging := set.String("staging-dir", "", "Theos staging directory")
	commitHash := set.String("commit-hash", "", "Commit hash")
	packageVersion := set.String("package-version", "", "Package version")
	if err := set.Parse(args); err != nil {
		return err
	}
	if *staging == "" || *commitHash == "" || *packageVersion == "" {
		return errors.New("usage: attest stage --staging-dir <dir> --commit-hash <hash> --package-version <version>")
	}
	if err := cleanStaging(*staging); err != nil {
		return err
	}
	if os.Getenv("DEBUG") == "1" {
		return nil
	}
	privateBytes, err := privateKeyBytes()
	if err != nil {
		return nil
	}
	private, err := parsePrivateKey(privateBytes)
	if err != nil {
		return err
	}
	public, err := pinnedPublicKey()
	if err != nil {
		return err
	}
	if !publicKeysEqual(&private.PublicKey, public) {
		return errors.New("attestation private key does not match the pinned public key")
	}
	dylib, err := findFile(*staging, "astral.dylib")
	if err != nil {
		return err
	}
	if err := signFile(dylib, private, *commitHash, *packageVersion); err != nil {
		return err
	}
	if _, err := verifyFile(dylib, public); err != nil {
		return err
	}
	if err := exec.Command("ldid", "-S", dylib).Run(); err != nil {
		return fmt.Errorf("ldid signing failed: %w", err)
	}
	if _, err := verifyFile(dylib, public); err != nil {
		return err
	}
	return nil
}

func attestStageELFCommand(args []string) error {
	set := flag.NewFlagSet("attest stage-elf", flag.ContinueOnError)
	directory := set.String("dir", "", "Directory holding the stripped libraries")
	library := set.String("library", "libastral.so", "Library file name")
	commitHash := set.String("commit-hash", "", "Commit hash")
	packageVersion := set.String("package-version", "", "Package version")
	if err := set.Parse(args); err != nil {
		return err
	}
	if *directory == "" || *commitHash == "" || *packageVersion == "" {
		return errors.New("usage: attest stage-elf --dir <dir> --commit-hash <hash> --package-version <version>")
	}
	privateBytes, err := privateKeyBytes()
	if err != nil {
		fmt.Println("No attestation key, leaving the libraries unsigned.")
		return nil
	}
	private, err := parsePrivateKey(privateBytes)
	if err != nil {
		return err
	}
	public, err := pinnedPublicKey()
	if err != nil {
		return err
	}
	if !publicKeysEqual(&private.PublicKey, public) {
		return errors.New("attestation private key does not match the pinned public key")
	}
	libraries, err := filepath.Glob(filepath.Join(*directory, "*", *library))
	if err != nil {
		return err
	}
	if len(libraries) == 0 {
		return fmt.Errorf("no %s under %s", *library, *directory)
	}
	for _, path := range libraries {
		if err := signFile(path, private, *commitHash, *packageVersion); err != nil {
			return fmt.Errorf("%s: %w", path, err)
		}
		if _, err := verifyFile(path, public); err != nil {
			return fmt.Errorf("%s: %w", path, err)
		}
		fmt.Printf("Signed %s\n", path)
	}
	return nil
}

func attestSignCommand(args []string) error {
	set := flag.NewFlagSet("attest sign", flag.ContinueOnError)
	path := set.String("path", "", "Mach-O path")
	privatePath := set.String("private-key", "", "Private key path")
	commitHash := set.String("commit-hash", "", "Commit hash")
	packageVersion := set.String("package-version", "", "Package version")
	if err := set.Parse(args); err != nil {
		return err
	}
	if *path == "" || *privatePath == "" || *commitHash == "" || *packageVersion == "" {
		return errors.New("usage: attest sign --path <path> --private-key <path> --commit-hash <hash> --package-version <version>")
	}
	privateBytes, err := os.ReadFile(*privatePath)
	if err != nil {
		return err
	}
	private, err := parsePrivateKey(privateBytes)
	if err != nil {
		return err
	}
	if err := signFile(*path, private, *commitHash, *packageVersion); err != nil {
		return err
	}
	return printJSON(map[string]string{"path": *path, "status": "signed"})
}

func attestVerifyCommand(args []string) error {
	set := flag.NewFlagSet("attest verify", flag.ContinueOnError)
	path := set.String("path", "", "Mach-O path")
	publicPath := set.String("public-key", "", "Public key path")
	if err := set.Parse(args); err != nil {
		return err
	}
	if *path == "" {
		if set.NArg() == 1 {
			*path = set.Arg(0)
		} else {
			return errors.New("usage: attest verify --path <path> --public-key <path>")
		}
	}
	var public *ecdsa.PublicKey
	var err error
	if *publicPath != "" {
		var raw []byte
		raw, err = os.ReadFile(*publicPath)
		if err == nil {
			public, err = parsePublicKey(raw)
		}
	} else {
		public, err = pinnedPublicKey()
	}
	if err != nil {
		return err
	}
	results, err := verifyFile(*path, public)
	if err != nil {
		return err
	}
	for _, result := range results {
		if err := printJSON(result); err != nil {
			return err
		}
	}
	return nil
}

func privateKeyBytes() ([]byte, error) {
	if value := os.Getenv("ATTESTATION_PK"); value != "" {
		return []byte(strings.ReplaceAll(value, "\r", "")), nil
	}
	return os.ReadFile(filepath.Join(repositoryRoot(), "attestation_private.pem"))
}

func repositoryRoot() string {
	directory, err := os.Getwd()
	if err != nil {
		return "."
	}
	for candidate := directory; ; candidate = filepath.Dir(candidate) {
		if _, err := os.Stat(filepath.Join(candidate, "go.mod")); err == nil {
			return candidate
		}
		if filepath.Dir(candidate) == candidate {
			return directory
		}
	}
}

func pinnedPublicKey() (*ecdsa.PublicKey, error) {
	raw, err := os.ReadFile(filepath.Join(repositoryRoot(), "tools", "attestation_public_key.b64"))
	if err != nil {
		if raw, err = os.ReadFile("attestation_public_key.b64"); err != nil {
			return nil, err
		}
	}
	decoded, err := base64.StdEncoding.DecodeString(strings.TrimSpace(string(raw)))
	if err != nil {
		return nil, err
	}
	return parsePublicKey(decoded)
}

func parsePrivateKey(raw []byte) (*ecdsa.PrivateKey, error) {
	if block, _ := pem.Decode(raw); block != nil {
		raw = block.Bytes
	}
	if key, err := x509.ParseECPrivateKey(raw); err == nil {
		return key, nil
	}
	key, err := x509.ParsePKCS8PrivateKey(raw)
	if err != nil {
		return nil, fmt.Errorf("invalid attestation private key: %w", err)
	}
	ecdsaKey, ok := key.(*ecdsa.PrivateKey)
	if !ok {
		return nil, errors.New("attestation private key is not ECDSA")
	}
	return ecdsaKey, nil
}

func parsePublicKey(raw []byte) (*ecdsa.PublicKey, error) {
	if block, _ := pem.Decode(raw); block != nil {
		raw = block.Bytes
	}
	key, err := x509.ParsePKIXPublicKey(raw)
	if err != nil {
		return nil, fmt.Errorf("invalid attestation public key: %w", err)
	}
	ecdsaKey, ok := key.(*ecdsa.PublicKey)
	if !ok {
		return nil, errors.New("attestation public key is not ECDSA")
	}
	return ecdsaKey, nil
}

func publicKeysEqual(left, right *ecdsa.PublicKey) bool {
	return left != nil && right != nil && left.Curve.Params().Name == right.Curve.Params().Name && left.X.Cmp(right.X) == 0 && left.Y.Cmp(right.Y) == 0
}

func isELF(data []byte) bool {
	return len(data) >= 4 && bytes.Equal(data[:4], []byte{0x7f, 'E', 'L', 'F'})
}

func parseELF(data []byte) (machoInfo, error) {
	if len(data) < 64 || data[4] != 2 || data[5] != 1 {
		return machoInfo{}, &AttestationError{"expected a little-endian 64-bit ELF library"}
	}
	machine := binary.LittleEndian.Uint16(data[18:20])
	tableOffset := binary.LittleEndian.Uint64(data[40:48])
	entrySize := binary.LittleEndian.Uint16(data[58:60])
	count := binary.LittleEndian.Uint16(data[60:62])
	namesIndex := binary.LittleEndian.Uint16(data[62:64])
	if entrySize != 64 || namesIndex >= count || tableOffset+uint64(count)*64 > uint64(len(data)) {
		return machoInfo{}, &AttestationError{"ELF section table is invalid"}
	}
	header := func(index uint16) int { return int(tableOffset) + int(index)*64 }
	namesOffset := binary.LittleEndian.Uint64(data[header(namesIndex)+24:])
	namesSize := binary.LittleEndian.Uint64(data[header(namesIndex)+32:])
	if namesOffset+namesSize > uint64(len(data)) {
		return machoInfo{}, &AttestationError{"ELF section names are outside the file"}
	}
	names := data[namesOffset : namesOffset+namesSize]
	info := machoInfo{cpuType: int32(machine), linkeditVMSize: -1, linkeditFileSize: -1, boundary: len(data)}
	for index := uint16(0); index < count; index++ {
		nameOffset := binary.LittleEndian.Uint32(data[header(index):])
		if nameOffset == 0 || uint64(nameOffset) >= namesSize || cString(names[nameOffset:]) != elfSectionName {
			continue
		}
		offset := binary.LittleEndian.Uint64(data[header(index)+24:])
		size := binary.LittleEndian.Uint64(data[header(index)+32:])
		if size != sectionSize || offset+size > uint64(len(data)) {
			return machoInfo{}, &AttestationError{"invalid attestation section"}
		}
		info.section = machoSection{offset: offset, size: size}
	}
	if info.section.size == 0 {
		return machoInfo{}, &AttestationError{"attestation section is missing"}
	}
	return info, nil
}

func parseThin(data []byte) (machoInfo, error) {
	if isELF(data) {
		return parseELF(data)
	}
	if len(data) < 32 {
		return machoInfo{}, &AttestationError{"Mach-O header is truncated"}
	}
	if readU32(data, 0, binary.LittleEndian) != magicThin64 {
		return machoInfo{}, &AttestationError{"expected a little-endian 64-bit Mach-O slice"}
	}
	info := machoInfo{cpuType: int32(readU32(data, 4, binary.LittleEndian)), cpuSubtype: int32(readU32(data, 8, binary.LittleEndian)), linkeditVMSize: -1, linkeditFileSize: -1}
	ncmds := readU32(data, 16, binary.LittleEndian)
	sizeofcmds := readU32(data, 20, binary.LittleEndian)
	commandsStart := 32
	commandsEnd := commandsStart + int(sizeofcmds)
	if commandsEnd > len(data) {
		return machoInfo{}, &AttestationError{"load commands are truncated"}
	}
	offset := commandsStart
	for i := uint32(0); i < ncmds; i++ {
		if offset+8 > commandsEnd {
			return machoInfo{}, &AttestationError{"load command header is truncated"}
		}
		command := readU32(data, offset, binary.LittleEndian)
		commandSize := int(readU32(data, offset+4, binary.LittleEndian))
		if commandSize < 8 || offset+commandSize > commandsEnd {
			return machoInfo{}, &AttestationError{"invalid load command size"}
		}
		if command == lcSegment64 {
			if commandSize < 72 {
				return machoInfo{}, &AttestationError{"segment command is truncated"}
			}
			name := cString(data[offset+8 : offset+24])
			if name == "__LINKEDIT" {
				info.linkeditVMSize = offset + 32
				info.linkeditFileSize = offset + 48
			}
			sectionCount := readU32(data, offset+64, binary.LittleEndian)
			sectionsEnd := offset + 72 + int(sectionCount)*80
			if sectionsEnd > offset+commandSize {
				return machoInfo{}, &AttestationError{"section table is truncated"}
			}
			sectionOffset := offset + 72
			for j := uint32(0); j < sectionCount; j++ {
				sectionName := cString(data[sectionOffset : sectionOffset+16])
				segmentName := cString(data[sectionOffset+16 : sectionOffset+32])
				if sectionName == "__attestation" && segmentName == "__TEXT" {
					fileSize := readU64(data, sectionOffset+40, binary.LittleEndian)
					fileOffset := uint64(readU32(data, sectionOffset+48, binary.LittleEndian))
					if fileSize != sectionSize || fileOffset+fileSize > uint64(len(data)) {
						return machoInfo{}, &AttestationError{"invalid attestation section"}
					}
					info.section = machoSection{offset: fileOffset, size: fileSize}
				}
				sectionOffset += 80
			}
		} else if command == lcCodeSignature {
			if commandSize < 16 {
				return machoInfo{}, &AttestationError{"code signature command is truncated"}
			}
			signatureOffset := readU32(data, offset+8, binary.LittleEndian)
			if signatureOffset > uint32(len(data)) {
				return machoInfo{}, &AttestationError{"code signature offset is outside the slice"}
			}
			info.codeSignature = &codeSignature{commandOffset: offset, offset: signatureOffset, size: readU32(data, offset+12, binary.LittleEndian)}
		}
		offset += commandSize
	}
	if info.section.size == 0 {
		return machoInfo{}, &AttestationError{"attestation section is missing"}
	}
	info.boundary = len(data)
	if info.codeSignature != nil {
		info.boundary = int(info.codeSignature.offset)
	}
	if info.boundary > len(data) {
		return machoInfo{}, &AttestationError{"canonicalization boundary is outside the slice"}
	}
	return info, nil
}

func fatSlices(data []byte) ([]machoSlice, error) {
	if len(data) < 4 {
		return nil, &AttestationError{"file is empty"}
	}
	magic := binary.BigEndian.Uint32(data[:4])
	if magic != magicFat && magic != magicFatSwapped && magic != magicFat64 && magic != magicFat64Swapped {
		info, err := parseThin(data)
		if err != nil {
			return nil, err
		}
		return []machoSlice{{offset: 0, size: len(data), cpuType: info.cpuType, cpuSubtype: info.cpuSubtype}}, nil
	}
	var endian binary.ByteOrder = binary.BigEndian
	if magic == magicFatSwapped || magic == magicFat64Swapped {
		endian = binary.LittleEndian
	}
	count := endian.Uint32(data[4:8])
	entrySize := 20
	is64 := magic == magicFat64 || magic == magicFat64Swapped
	if is64 {
		entrySize = 32
	}
	if 8+int(count)*entrySize > len(data) {
		return nil, &AttestationError{"fat architecture table is truncated"}
	}
	slices := make([]machoSlice, 0, count)
	for i := uint32(0); i < count; i++ {
		entry := 8 + int(i)*entrySize
		cpuType := int32(endian.Uint32(data[entry : entry+4]))
		cpuSubtype := int32(endian.Uint32(data[entry+4 : entry+8]))
		var offset, size uint64
		if is64 {
			offset = endian.Uint64(data[entry+8 : entry+16])
			size = endian.Uint64(data[entry+16 : entry+24])
		} else {
			offset = uint64(endian.Uint32(data[entry+8 : entry+12]))
			size = uint64(endian.Uint32(data[entry+12 : entry+16]))
		}
		if offset+size > uint64(len(data)) {
			return nil, &AttestationError{"fat architecture slice is outside the file"}
		}
		slices = append(slices, machoSlice{offset: int(offset), size: int(size), cpuType: cpuType, cpuSubtype: cpuSubtype})
	}
	return slices, nil
}

func canonicalSlice(slice []byte) ([]byte, machoInfo, error) {
	info, err := parseThin(slice)
	if err != nil {
		return nil, machoInfo{}, err
	}
	canonical := append([]byte(nil), slice[:info.boundary]...)
	sectionOffset := int(info.section.offset)
	if sectionOffset+sectionSize > len(canonical) {
		return nil, machoInfo{}, &AttestationError{"attestation section is outside canonical data"}
	}
	clear := func(start, end int) error {
		if start < 0 || end > len(canonical) {
			return &AttestationError{"canonical data field is outside bounds"}
		}
		clearBytes(canonical[start:end])
		return nil
	}
	if err := clear(sectionOffset+24, sectionOffset+56); err != nil {
		return nil, machoInfo{}, err
	}
	if err := clear(sectionOffset+56, sectionOffset+58); err != nil {
		return nil, machoInfo{}, err
	}
	if err := clear(sectionOffset+60, sectionOffset+60+signatureCapacity); err != nil {
		return nil, machoInfo{}, err
	}
	if info.codeSignature != nil {
		if err := clear(info.codeSignature.commandOffset+8, info.codeSignature.commandOffset+16); err != nil {
			return nil, machoInfo{}, err
		}
	}
	if info.linkeditVMSize >= 0 {
		if err := clear(info.linkeditVMSize, info.linkeditVMSize+8); err != nil {
			return nil, machoInfo{}, err
		}
	}
	if info.linkeditFileSize >= 0 {
		if err := clear(info.linkeditFileSize, info.linkeditFileSize+8); err != nil {
			return nil, machoInfo{}, err
		}
	}
	return canonical, info, nil
}

func readAttestation(slice []byte, info machoInfo) (attestation, error) {
	offset := int(info.section.offset)
	if offset+sectionSize > len(slice) {
		return attestation{}, &AttestationError{"attestation section is outside the slice"}
	}
	raw := slice[offset : offset+sectionSize]
	value := attestation{}
	value.magic = binary.LittleEndian.Uint32(raw[0:4])
	value.version = binary.LittleEndian.Uint16(raw[4:6])
	value.algorithm = binary.LittleEndian.Uint16(raw[6:8])
	value.size = binary.LittleEndian.Uint32(raw[8:12])
	value.keyID = binary.LittleEndian.Uint32(raw[12:16])
	value.cpuType = int32(binary.LittleEndian.Uint32(raw[16:20]))
	value.cpuSubtype = int32(binary.LittleEndian.Uint32(raw[20:24]))
	copy(value.digest[:], raw[24:56])
	value.signatureLength = binary.LittleEndian.Uint16(raw[56:58])
	if int(value.signatureLength) > signatureCapacity {
		return attestation{}, &AttestationError{"attestation signature length is invalid"}
	}
	value.signature = append([]byte(nil), raw[60:60+int(value.signatureLength)]...)
	value.commitHash = strings.TrimRight(string(raw[156:197]), "\x00")
	value.packageVersion = strings.TrimRight(string(raw[197:229]), "\x00")
	return value, nil
}

func signFile(path string, private *ecdsa.PrivateKey, commitHash, packageVersion string) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	slices, err := fatSlices(data)
	if err != nil {
		return err
	}
	if len(commitHash) > 40 || len(packageVersion) > 31 {
		return &AttestationError{"attestation metadata exceeds its fixed capacity"}
	}
	for _, slice := range slices {
		part := append([]byte(nil), data[slice.offset:slice.offset+slice.size]...)
		info, err := parseThin(part)
		if err != nil {
			return err
		}
		section := make([]byte, sectionSize)
		binary.LittleEndian.PutUint32(section[0:4], attestationMagic)
		binary.LittleEndian.PutUint16(section[4:6], attestationVersion)
		binary.LittleEndian.PutUint16(section[6:8], attestationAlgorithm)
		binary.LittleEndian.PutUint32(section[8:12], sectionSize)
		binary.LittleEndian.PutUint32(section[12:16], attestationKeyID)
		binary.LittleEndian.PutUint32(section[16:20], uint32(slice.cpuType))
		binary.LittleEndian.PutUint32(section[20:24], uint32(slice.cpuSubtype))
		copy(section[156:197], commitHash)
		copy(section[197:229], packageVersion)
		sectionOffset := int(info.section.offset)
		copy(part[sectionOffset:sectionOffset+sectionSize], section)
		canonical, _, err := canonicalSlice(part)
		if err != nil {
			return err
		}
		digest := sha256.Sum256(canonical)
		signature, err := ecdsa.SignASN1(rand.Reader, private, digest[:])
		if err != nil {
			return err
		}
		if len(signature) > signatureCapacity {
			return &AttestationError{"P-256 signature exceeds embedded capacity"}
		}
		copy(section[24:56], digest[:])
		binary.LittleEndian.PutUint16(section[56:58], uint16(len(signature)))
		copy(section[60:60+len(signature)], signature)
		copy(data[slice.offset+sectionOffset:slice.offset+sectionOffset+sectionSize], section)
	}
	return os.WriteFile(path, data, 0o644)
}

func verifyFile(path string, public *ecdsa.PublicKey) ([]map[string]any, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	slices, err := fatSlices(data)
	if err != nil {
		return nil, err
	}
	results := make([]map[string]any, 0, len(slices))
	for _, slice := range slices {
		part := data[slice.offset : slice.offset+slice.size]
		canonical, info, err := canonicalSlice(part)
		if err != nil {
			return nil, err
		}
		value, err := readAttestation(part, info)
		if err != nil {
			return nil, err
		}
		if value.magic != attestationMagic || value.version != attestationVersion || value.algorithm != attestationAlgorithm {
			return nil, &AttestationError{"attestation header is invalid"}
		}
		if value.size != sectionSize || value.keyID != attestationKeyID {
			return nil, &AttestationError{"attestation metadata is invalid"}
		}
		if value.cpuType != slice.cpuType || value.cpuSubtype != slice.cpuSubtype {
			return nil, &AttestationError{"attestation architecture does not match its slice"}
		}
		if value.signatureLength < 1 || value.signatureLength > signatureCapacity {
			return nil, &AttestationError{"attestation signature length is invalid"}
		}
		digest := sha256.Sum256(canonical)
		if !bytes.Equal(digest[:], value.digest[:]) {
			return nil, &AttestationError{"attestation digest does not match the binary"}
		}
		if !ecdsa.VerifyASN1(public, digest[:], value.signature) {
			return nil, &AttestationError{"attestation signature verification failed"}
		}
		results = append(results, map[string]any{"cpuType": slice.cpuType, "cpuSubtype": slice.cpuSubtype, "digest": hex.EncodeToString(digest[:]), "signatureLength": value.signatureLength, "commitHash": value.commitHash, "packageVersion": value.packageVersion})
	}
	return results, nil
}

func clearBytes(value []byte) {
	for i := range value {
		value[i] = 0
	}
}

func readU32(data []byte, offset int, order binary.ByteOrder) uint32 {
	return order.Uint32(data[offset : offset+4])
}
func readU64(data []byte, offset int, order binary.ByteOrder) uint64 {
	return order.Uint64(data[offset : offset+8])
}

func cString(value []byte) string {
	if index := bytes.IndexByte(value, 0); index >= 0 {
		value = value[:index]
	}
	return string(value)
}

func printJSON(value any) error {
	encoded, err := json.Marshal(value)
	if err != nil {
		return err
	}
	fmt.Println(string(encoded))
	return nil
}

func findFile(root, name string) (string, error) {
	var found string
	err := filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() && info.Name() == name && found == "" {
			found = path
		}
		return nil
	})
	if err != nil {
		return "", err
	}
	if found == "" {
		return "", fmt.Errorf("could not find %s under %s", name, root)
	}
	return found, nil
}

func cleanStaging(root string) error {
	return filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() && (info.Name() == ".DS_Store" || info.Name() == "signature.bin" || info.Name() == "public_key.der") {
			return os.Remove(path)
		}
		return nil
	})
}
