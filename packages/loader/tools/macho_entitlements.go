package main

import (
	"bytes"
	"debug/macho"
	"encoding/binary"
)

const (
	machoLoadCodeSignature = 0x1d
	codeSignatureSuperBlob = 0xfade0cc0
	codeSignatureEntitled  = 0xfade7171
	codeSignatureSlotEnts  = 5
	superBlobHeaderSize    = 12
	blobIndexSize          = 8
	blobHeaderSize         = 8
	appGroupsEntitlement   = "com.apple.security.application-groups"
)

func codeSignatureBytes(data []byte) []byte {
	file, err := macho.NewFile(bytes.NewReader(data))
	if err != nil {
		return nil
	}
	for _, load := range file.Loads {
		raw := load.Raw()
		if len(raw) < 16 || binary.LittleEndian.Uint32(raw) != machoLoadCodeSignature {
			continue
		}
		offset := uint64(binary.LittleEndian.Uint32(raw[8:]))
		size := uint64(binary.LittleEndian.Uint32(raw[12:]))
		if offset+size > uint64(len(data)) {
			return nil
		}
		return data[offset : offset+size]
	}
	return nil
}

func entitlementsBlob(signature []byte, offset uint32) []byte {
	if uint64(offset)+blobHeaderSize > uint64(len(signature)) {
		return nil
	}
	blob := signature[offset:]
	if binary.BigEndian.Uint32(blob) != codeSignatureEntitled {
		return nil
	}
	length := binary.BigEndian.Uint32(blob[4:])
	if length < blobHeaderSize || uint64(length) > uint64(len(blob)) {
		return nil
	}
	return blob[blobHeaderSize:length]
}

func machoEntitlements(data []byte) []byte {
	signature := codeSignatureBytes(data)
	if len(signature) < superBlobHeaderSize || binary.BigEndian.Uint32(signature) != codeSignatureSuperBlob {
		return nil
	}
	count := binary.BigEndian.Uint32(signature[8:])
	for index := range count {
		entry := superBlobHeaderSize + uint64(index)*blobIndexSize
		if entry+blobIndexSize > uint64(len(signature)) {
			return nil
		}
		if binary.BigEndian.Uint32(signature[entry:]) == codeSignatureSlotEnts {
			return entitlementsBlob(signature, binary.BigEndian.Uint32(signature[entry+4:]))
		}
	}
	return nil
}

func machoAppGroups(data []byte) []string {
	entitlements := machoEntitlements(data)
	if entitlements == nil {
		return nil
	}
	plist, err := readPlist(entitlements)
	if err != nil {
		return nil
	}
	var groups []string
	for _, group := range plist.get(appGroupsEntitlement).valuesOrNil() {
		groups = append(groups, group.text)
	}
	return groups
}
