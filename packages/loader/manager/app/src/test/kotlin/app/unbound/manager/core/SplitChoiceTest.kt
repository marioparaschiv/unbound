package app.unbound.manager.core

import org.junit.Assert.assertEquals
import org.junit.Test

class SplitChoiceTest {
    private val bundle = listOf(
        "base-487-lspatched.apk",
        "config.arm64_v8a-487-lspatched.apk",
        "config.armeabi_v7a-487-lspatched.apk",
        "config.x86_64-487-lspatched.apk",
        "config.en-487-lspatched.apk",
        "config.xxhdpi-487-lspatched.apk",
    )

    private fun installs(vararg entries: String) = SplitChoice.Install(entries.toList())

    @Test
    fun `a phone installs base, its own ABI and every language and density split`() {
        assertEquals(
            installs(
                "base-487-lspatched.apk",
                "config.arm64_v8a-487-lspatched.apk",
                "config.en-487-lspatched.apk",
                "config.xxhdpi-487-lspatched.apk",
            ),
            selectSplits(bundle, listOf("arm64-v8a", "armeabi-v7a", "armeabi")),
        )
    }

    @Test
    fun `the first supported ABI with a split wins`() {
        val noX86 = bundle - "config.x86_64-487-lspatched.apk"

        assertEquals(
            installs(
                "base-487-lspatched.apk",
                "config.arm64_v8a-487-lspatched.apk",
                "config.en-487-lspatched.apk",
                "config.xxhdpi-487-lspatched.apk",
            ),
            selectSplits(noX86, listOf("x86_64", "arm64-v8a")),
        )
        assertEquals(
            "config.x86_64-487-lspatched.apk",
            (selectSplits(bundle, listOf("x86_64", "arm64-v8a")) as SplitChoice.Install).entries[1],
        )
    }

    @Test
    fun `a device whose ABIs the bundle lacks is rejected`() {
        assertEquals(SplitChoice.Reject(Failure.NoSplitForDevice), selectSplits(bundle, listOf("riscv64")))
    }

    @Test
    fun `a bundle without ABI splits is universal`() {
        assertEquals(installs("base.apk", "config.en.apk"), selectSplits(listOf("base.apk", "config.en.apk", "toc.pb"), listOf("x86")))
    }

    @Test
    fun `a bundle needs exactly one base`() {
        assertEquals(true, selectSplits(listOf("config.en.apk"), listOf("x86_64")) is SplitChoice.Reject)
        assertEquals(true, selectSplits(listOf("base.apk", "base-2.apk"), listOf("x86_64")) is SplitChoice.Reject)
    }
}
