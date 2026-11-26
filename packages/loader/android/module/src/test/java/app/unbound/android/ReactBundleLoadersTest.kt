package app.unbound.android

import android.content.res.AssetManager
import com.facebook.react.bridge.JSBundleLoader
import org.junit.Assert.assertEquals
import org.junit.Assert.assertSame
import org.junit.Test
import java.lang.reflect.Modifier

@Suppress("UNUSED_PARAMETER")
private class DirectBundleLoaders {
    fun loadJSBundleFromAssets(assetManager: AssetManager, sourceURL: String) = Unit

    fun loadJSBundleFromFile(fileName: String, sourceURL: String) = Unit
}

@Suppress("UNUSED_PARAMETER")
private class Discord352BundleLoaders {
    fun loadAssets(assetManager: AssetManager, sourceURL: String) = Unit

    fun loadFile(fileName: String, sourceURL: String) = Unit

    companion object {
        @JvmStatic
        @JvmSynthetic
        fun a(instance: Discord352BundleLoaders, assetManager: AssetManager, sourceURL: String) =
            instance.loadAssets(assetManager, sourceURL)

        @JvmStatic
        @JvmSynthetic
        fun b(instance: Discord352BundleLoaders, fileName: String, sourceURL: String) =
            instance.loadFile(fileName, sourceURL)
    }
}

@Suppress("UNUSED_PARAMETER")
private class Discord354BundleLoaders {
    fun loadAssets(assetManager: AssetManager, sourceURL: String) = Unit

    fun loadFile(fileName: String, sourceURL: String) = Unit

    companion object {
        @JvmStatic
        @JvmSynthetic
        fun assets(instance: Discord354BundleLoaders, assetManager: AssetManager, sourceURL: String) =
            instance.loadAssets(assetManager, sourceURL)

        @JvmStatic
        @JvmSynthetic
        fun file(instance: Discord354BundleLoaders, fileName: String, sourceURL: String) =
            instance.loadFile(fileName, sourceURL)
    }
}

@Suppress("UNUSED_PARAMETER")
private class AmbiguousBundleLoaders {
    companion object {
        @JvmStatic
        @JvmSynthetic
        fun first(instance: AmbiguousBundleLoaders, fileName: String, sourceURL: String) = Unit

        @JvmStatic
        @JvmSynthetic
        fun second(instance: AmbiguousBundleLoaders, fileName: String, sourceURL: String) = Unit
    }
}

private class LegacyReactInstance {
    fun loadJSBundle(loader: JSBundleLoader) = Unit
}

class ReactBundleLoadersTest {
    private val classLoader = ReactBundleLoadersTest::class.java.classLoader!!

    @Test
    fun supportsDiscord352SyntheticAccessors() {
        val loaders = ReactBundleLoaders.find(Discord352BundleLoaders::class.java, classLoader)

        assertEquals(setOf("a", "b"), loaders.map { it.name }.toSet())
        assertEquals(2, loaders.count { Modifier.isStatic(it.modifiers) && it.isSynthetic })
    }

    @Test
    fun supportsDiscord354SyntheticAccessorsWithoutDependingOnNames() {
        val loaders = ReactBundleLoaders.find(Discord354BundleLoaders::class.java, classLoader)

        assertEquals(setOf("assets", "file"), loaders.map { it.name }.toSet())
        assertEquals(2, loaders.count { Modifier.isStatic(it.modifiers) && it.isSynthetic })
    }

    @Test
    fun getsStaticAccessorInstanceFromFirstArgument() {
        val loader = ReactBundleLoaders.find(Discord354BundleLoaders::class.java, classLoader).first()
        val instance = Discord354BundleLoaders()

        assertSame(instance, ReactBundleLoaders.instance(loader, null, instance))
    }

    @Test
    fun rejectsDirectNativeLoaderShape() {
        val loaders = ReactBundleLoaders.find(DirectBundleLoaders::class.java, classLoader)

        assertEquals(emptyList<Any>(), loaders)
    }

    @Test
    fun rejectsAmbiguousSyntheticAccessors() {
        val loaders = ReactBundleLoaders.find(AmbiguousBundleLoaders::class.java, classLoader)

        assertEquals(emptyList<Any>(), loaders)
    }

    @Test
    fun prefersLegacyLoaderOverDirectNativeMethods() {
        val loaders = ReactBundleLoaders.find(LegacyReactInstance::class.java, classLoader)
        val instance = LegacyReactInstance()

        assertEquals(listOf("loadJSBundle"), loaders.map { it.name })
        assertSame(instance, ReactBundleLoaders.instance(loaders.single(), instance, null))
    }
}
