package app.unbound.manager.core

/** Which entries of a `.apks` bundle this device installs, or why it cannot install any. */
sealed interface SplitChoice {
    data class Install(val entries: List<String>) : SplitChoice

    data class Reject(val failure: Failure) : SplitChoice
}

/**
 * Base, the split for the first of [supportedAbis] (Build.SUPPORTED_ABIS order) that the bundle has,
 * and every other split except the ABI splits for other ABIs. A bundle with no ABI splits is universal.
 */
fun selectSplits(entries: List<String>, supportedAbis: List<String>): SplitChoice {
    val apks = entries.filter { it.endsWith(".apk") && '/' !in it }
    val bases = apks.filter { it.startsWith("base") }

    if (bases.size != 1) return SplitChoice.Reject(Failure.BadArchive("expected one base APK, found ${bases.size}"))

    val abiSplits = apks.filter { it.configQualifier() in ABI_QUALIFIERS }
    val chosen = supportedAbis
        .map { it.replace('-', '_') }
        .firstNotNullOfOrNull { abi -> abiSplits.find { it.configQualifier() == abi } }

    if (abiSplits.isNotEmpty() && chosen == null) return SplitChoice.Reject(Failure.NoSplitForDevice)

    return SplitChoice.Install(bases + apks.filter { it !in bases && (it !in abiSplits || it == chosen) })
}

/** "config.arm64_v8a-487-lspatched.apk" and "config.arm64_v8a.apk" both give "arm64_v8a". */
private fun String.configQualifier(): String? =
    removePrefix("config.").takeIf { it != this }?.removeSuffix(".apk")?.substringBefore('-')

private val ABI_QUALIFIERS = setOf("arm64_v8a", "armeabi_v7a", "armeabi", "x86_64", "x86", "riscv64", "mips", "mips64")
