package main

import (
	"encoding/binary"
	"errors"
	"fmt"
	"unicode/utf16"
)

const hermesMagic = 0x1F1903C103BC1FC6

type hermesStrings struct {
	Version     uint32
	strings     map[string]bool
	identifiers map[string]bool
}

func (table *hermesStrings) has(value string) bool {
	return table.strings[value]
}

func (table *hermesStrings) isIdentifier(value string) bool {
	return table.identifiers[value]
}

type hermesHeader struct {
	version             uint32
	functionCount       uint32
	stringKindCount     uint32
	identifierCount     uint32
	stringCount         uint32
	overflowStringCount uint32
	stringStorageSize   uint32
}

func parseHermesStrings(data []byte) (*hermesStrings, error) {
	if len(data) < 128 || binary.LittleEndian.Uint64(data) != hermesMagic {
		return nil, errors.New("not a Hermes bytecode bundle")
	}
	header := hermesHeader{
		version:             binary.LittleEndian.Uint32(data[8:]),
		functionCount:       binary.LittleEndian.Uint32(data[40:]),
		stringKindCount:     binary.LittleEndian.Uint32(data[44:]),
		identifierCount:     binary.LittleEndian.Uint32(data[48:]),
		stringCount:         binary.LittleEndian.Uint32(data[52:]),
		overflowStringCount: binary.LittleEndian.Uint32(data[56:]),
		stringStorageSize:   binary.LittleEndian.Uint32(data[60:]),
	}

	for _, functionHeaderSize := range []uint64{12, 16} {
		table, err := readHermesStringTable(data, header, functionHeaderSize)
		if err == nil {
			return table, nil
		}
	}
	return nil, fmt.Errorf("unsupported Hermes bytecode version %d", header.version)
}

func alignFour(offset uint64) uint64 {
	return (offset + 3) &^ 3
}

func readHermesStringTable(data []byte, header hermesHeader, functionHeaderSize uint64) (*hermesStrings, error) {
	size := uint64(len(data))
	offset := alignFour(128 + uint64(header.functionCount)*functionHeaderSize)

	kindsEnd := offset + 4*uint64(header.stringKindCount)
	if kindsEnd > size {
		return nil, errors.New("string kinds out of range")
	}
	kinds := make([]uint32, header.stringKindCount)
	var total, identifiers uint64
	for index := range kinds {
		kinds[index] = binary.LittleEndian.Uint32(data[offset+4*uint64(index):])
		count := uint64(kinds[index] & 0x7FFFFFFF)
		total += count
		if kinds[index]>>31 == 1 {
			identifiers += count
		}
	}
	if total != uint64(header.stringCount) || identifiers != uint64(header.identifierCount) {
		return nil, errors.New("string kinds do not match the string count")
	}
	offset = alignFour(kindsEnd)
	offset = alignFour(offset + 4*uint64(header.identifierCount))

	smallTable := offset
	offset = alignFour(offset + 4*uint64(header.stringCount))
	overflowTable := offset
	offset = alignFour(offset + 8*uint64(header.overflowStringCount))
	storage := offset
	if storage+uint64(header.stringStorageSize) > size {
		return nil, errors.New("string storage out of range")
	}

	table := &hermesStrings{
		Version:     header.version,
		strings:     make(map[string]bool, header.stringCount),
		identifiers: make(map[string]bool, header.identifierCount),
	}
	kindIndex, kindRemaining := 0, uint64(0)
	if len(kinds) > 0 {
		kindRemaining = uint64(kinds[0] & 0x7FFFFFFF)
	}

	for index := uint64(0); index < uint64(header.stringCount); index++ {
		for kindRemaining == 0 && kindIndex+1 < len(kinds) {
			kindIndex++
			kindRemaining = uint64(kinds[kindIndex] & 0x7FFFFFFF)
		}
		kindRemaining--

		entry := binary.LittleEndian.Uint32(data[smallTable+4*index:])
		isUTF16 := entry&1 == 1
		start := uint64(entry>>1) & 0x7FFFFF
		length := uint64(entry >> 24)
		if length == 0xFF {
			overflow := overflowTable + 8*start
			if overflow+8 > size {
				return nil, errors.New("overflow string out of range")
			}
			start = uint64(binary.LittleEndian.Uint32(data[overflow:]))
			length = uint64(binary.LittleEndian.Uint32(data[overflow+4:]))
		}
		byteLength := length
		if isUTF16 {
			byteLength *= 2
		}
		if storage+start+byteLength > size {
			return nil, errors.New("string out of range")
		}
		raw := data[storage+start : storage+start+byteLength]

		value := decodeHermesString(raw, isUTF16)
		table.strings[value] = true
		if kinds[kindIndex]>>31 == 1 {
			table.identifiers[value] = true
		}
	}
	return table, nil
}

func decodeHermesString(raw []byte, isUTF16 bool) string {
	if !isUTF16 {
		runes := make([]rune, len(raw))
		for index, value := range raw {
			runes[index] = rune(value)
		}
		return string(runes)
	}
	units := make([]uint16, len(raw)/2)
	for index := range units {
		units[index] = binary.LittleEndian.Uint16(raw[2*index:])
	}
	return string(utf16.Decode(units))
}
