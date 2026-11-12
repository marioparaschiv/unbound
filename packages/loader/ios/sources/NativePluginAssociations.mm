#import "NativePluginAssociations.h"

#include <optional>

#import "NativeAssociationPolicy.h"

using namespace facebook;
using namespace facebook::jsi;

namespace loader::ios {
static objc_AssociationPolicy objcAssociationPolicy(loader::native::AssociationPolicy policy)
{
    switch (policy)
    {
        case loader::native::AssociationPolicy::Assign:
            return OBJC_ASSOCIATION_ASSIGN;
        case loader::native::AssociationPolicy::Retain:
            return OBJC_ASSOCIATION_RETAIN;
        case loader::native::AssociationPolicy::Copy:
            return OBJC_ASSOCIATION_COPY;
        case loader::native::AssociationPolicy::CopyNonatomic:
            return OBJC_ASSOCIATION_COPY_NONATOMIC;
        case loader::native::AssociationPolicy::RetainNonatomic:
            return OBJC_ASSOCIATION_RETAIN_NONATOMIC;
    }
    return OBJC_ASSOCIATION_RETAIN_NONATOMIC;
}

objc_AssociationPolicy associationPolicy(Runtime &runtime, const Value *value)
{
    if (!value || !value->isString())
    {
        return objcAssociationPolicy(loader::native::kDefaultAssociationPolicy);
    }

    std::optional<loader::native::AssociationPolicy> policy =
        loader::native::associationPolicyNamed(value->asString(runtime).utf8(runtime));
    if (!policy)
    {
        throw JSError(runtime, "Unsupported native association policy");
    }
    return objcAssociationPolicy(*policy);
}
}
