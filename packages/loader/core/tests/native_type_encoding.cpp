#include <cassert>
#include <random>
#include <string>

#include "NativeTypeEncoding.h"

int main()
{
    assert(normalizedType(nullptr) == '\0');
    assert(normalizedType("rnNoORV@") == '@');
    assert(nativeFFITypeName("v") == "void");
    assert(nativeFFITypeName("r@") == "object");
    assert(nativeFFITypeName("@\"NSString\"") == "object");
    assert(nativeFFITypeName("r@\"<NSCopying>\"") == "object");
    assert(nativeFFITypeName("#") == "class");
    assert(nativeFFITypeName(":") == "selector");
    assert(nativeFFITypeName("^v") == "pointer");
    assert(nativeFFITypeName("q") == "i64");
    assert(nativeFFITypeName("Q") == "u64");
    assert(nativeFFITypeName("{CGRect={CGPoint=dd}{CGSize=dd}}") == "struct:CGRect");
    assert(nativeFFITypeName("r{_NSRange=QQ}") == "struct:NSRange");
    assert(nativeFFITypeName("{UIEdgeInsets=dddd}") == "struct:UIEdgeInsets");
    assert(nativeFFITypeName("{CGAffineTransform=dddddd}") == "struct:CGAffineTransform");
    assert(nativeFFITypeName("{_CGRect={_CGPoint=dd}{_CGSize=dd}}") == "struct:CGRect");
    assert(nativeFFITypeName("i24").empty());
    assert(nativeFFITypeName("dgarbage").empty());
    assert(nativeFFITypeName("@?").empty());
    assert(nativeFFITypeName("@\"\"").empty());
    assert(nativeFFITypeName("@\"NSString\"trailing").empty());
    assert(nativeFFITypeName("{CGRect=dddd}").empty());
    assert(nativeFFITypeName("{CGRect={CGPoint=dd}{CGSize=ff}}").empty());
    assert(nativeFFITypeName("{CGRect={CGPoint=dd}{CGSize=dd}}extra").empty());
    assert(nativeFFITypeName("{NSRange=ii}").empty());
    assert(nativeFFITypeName("{UIEdgeInsets=ffff}").empty());
    assert(nativeFFITypeName("{CGAffineTransform=dddddd}extra").empty());
    assert(nativeFFITypeName("{Unknown=CGRect}").empty());
    assert(nativeFFITypeName("{Unknown=dd}").empty());
    assert(nativeFFITypeName("(Union=ii)").empty());
    assert(nativeFFITypeName("b8").empty());

    for (int index = 0; index < 10000; index++)
    {
        std::string malformed = "{Unknown" + std::to_string(index) + "=CGRect}";
        assert(nativeFFITypeName(malformed.c_str()).empty());
    }

    std::mt19937                       generator(0x4e415449);
    std::uniform_int_distribution<int> length(0, 128);
    std::uniform_int_distribution<int> byte(1, 255);
    for (int index = 0; index < 50000; index++)
    {
        std::string encoding;
        int         count = length(generator);
        encoding.reserve(count);
        for (int position = 0; position < count; position++)
        {
            encoding.push_back(static_cast<char>(byte(generator)));
        }
        normalizedType(encoding.c_str());
        nativeFFITypeName(encoding.c_str());
    }
}
