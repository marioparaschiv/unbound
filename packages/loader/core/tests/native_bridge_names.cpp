#include <cassert>
#include <cstring>
#include <string>

#include "NativeAssociationPolicy.h"
#include "NativeNumericValidation.h"
#include "NativeTypeEncoding.h"

using loader::native::AssociationPolicy;
using loader::native::associationPolicyNamed;

int main()
{
    for (const char *type :
         {"bool", "float", "double", "i8", "u8", "i16", "u16", "i32", "u32", "i64", "u64"})
    {
        assert(isNativeScalarType(type));
    }
    for (const char *type : {"", "void", "object", "pointer", "struct:CGRect", "i128", "Bool"})
    {
        assert(!isNativeScalarType(type));
    }

    assert(std::strcmp(nativeStructEncoding("NSRange"), "{_NSRange=QQ}") == 0);
    assert(std::strcmp(nativeStructEncoding("CGPoint"), "{CGPoint=dd}") == 0);
    assert(std::strcmp(nativeStructEncoding("CGSize"), "{CGSize=dd}") == 0);
    assert(std::strcmp(nativeStructEncoding("CGRect"), "{CGRect={CGPoint=dd}{CGSize=dd}}") == 0);
    assert(std::strcmp(nativeStructEncoding("UIEdgeInsets"), "{UIEdgeInsets=dddd}") == 0);
    assert(std::strcmp(nativeStructEncoding("CGAffineTransform"), "{CGAffineTransform=dddddd}") ==
           0);
    assert(!nativeStructEncoding("CGVector"));
    assert(!nativeStructEncoding(""));
    for (const char *name : {"CGPoint", "CGSize", "CGRect", "NSRange", "UIEdgeInsets"})
    {
        assert(nativeFFITypeName(nativeStructEncoding(name)) == std::string("struct:") + name);
    }

    assert(associationPolicyNamed("assign") == AssociationPolicy::Assign);
    assert(associationPolicyNamed("retain") == AssociationPolicy::Retain);
    assert(associationPolicyNamed("copy") == AssociationPolicy::Copy);
    assert(associationPolicyNamed("copyNonatomic") == AssociationPolicy::CopyNonatomic);
    assert(associationPolicyNamed("retainNonatomic") == AssociationPolicy::RetainNonatomic);
    assert(!associationPolicyNamed("strong"));
    assert(!associationPolicyNamed(""));
    assert(loader::native::kDefaultAssociationPolicy == AssociationPolicy::RetainNonatomic);
    return 0;
}
