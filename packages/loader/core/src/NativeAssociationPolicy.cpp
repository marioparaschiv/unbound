#include "NativeAssociationPolicy.h"

namespace loader::native {
std::optional<AssociationPolicy> associationPolicyNamed(std::string_view name)
{
    if (name == "assign")
    {
        return AssociationPolicy::Assign;
    }
    if (name == "retain")
    {
        return AssociationPolicy::Retain;
    }
    if (name == "copy")
    {
        return AssociationPolicy::Copy;
    }
    if (name == "copyNonatomic")
    {
        return AssociationPolicy::CopyNonatomic;
    }
    if (name == "retainNonatomic")
    {
        return AssociationPolicy::RetainNonatomic;
    }
    return std::nullopt;
}
}
