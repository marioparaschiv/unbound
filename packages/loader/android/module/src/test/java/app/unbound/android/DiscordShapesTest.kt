package app.unbound.android

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

open class ShapeBase

interface ShapeContract

class ShapeHost :
    ShapeBase(),
    ShapeContract

@Suppress("UNUSED_PARAMETER")
class ShapeOwner(value: Int, label: String) {
    private val id: String = ""
    private val author: String? = null
    private val count: Int = 0

    fun bind(message: ShapeHost, index: Int) = Unit

    fun bind(message: ShapeHost, index: Int, extra: Long) = Unit

    fun base(): ShapeBase? = null

    fun contract(): ShapeContract? = null

    fun anything(): Any? = null

    companion object {
        @JvmStatic
        fun create(message: ShapeHost, index: Int, extra: Long, more: Long) = ShapeOwner(index, "")

        @JvmField
        val TAG: String = "tag"
    }
}

@Suppress("UNUSED_PARAMETER")
class ShapeSurface(id: Int)

@Suppress("UNUSED_PARAMETER")
class OtherShapeSurface(id: Int)

@Suppress("UNUSED_PARAMETER")
class ShapeRegistry {
    fun register(surface: ShapeSurface) = Unit

    fun unregister(surface: ShapeSurface) = Unit

    fun name(label: String) = Unit
}

@Suppress("UNUSED_PARAMETER")
class AmbiguousShapeRegistry {
    fun register(surface: ShapeSurface) = Unit

    fun registerOther(surface: OtherShapeSurface) = Unit
}

class DiscordShapesTest {
    private val resolve = discordClasses(
        "com.discord.ShapeOwner" to ShapeOwner::class.java,
        "com.discord.ShapeHost" to ShapeHost::class.java,
        "com.discord.ShapeRegistry" to ShapeRegistry::class.java,
        "com.discord.AmbiguousShapeRegistry" to AmbiguousShapeRegistry::class.java,
    )

    private fun shapes(vararg rules: Pair<String, DiscordShape>) = DiscordShapes(rules.toMap(), resolve)

    @Test
    fun findsTheOnlyNonStaticFieldOfAType() {
        val shapes = shapes(
            "count" to DiscordShape(owner = "com.discord.ShapeOwner", member = "field", type = "int", pick = "only"),
            "tag" to
                DiscordShape(owner = "com.discord.ShapeOwner", member = "field", static = true, type = "java.lang.String", pick = "only"),
        )

        assertEquals("count", shapes.shapeField("count").name)
        assertEquals("TAG", shapes.shapeField("tag").name)
    }

    @Test
    fun refusesSeveralFieldsThatFit() {
        val shapes = shapes(
            "text" to
                DiscordShape(owner = "com.discord.ShapeOwner", member = "field", static = false, type = "java.lang.String", pick = "only"),
        )

        val failure = assertThrows(IllegalStateException::class.java) { shapes.shapeField("text") }

        assertTrue(failure.message!!.contains("ambiguous"))
    }

    @Test
    fun countsEveryFieldWhenThePickWantsAll() {
        val shapes = shapes(
            "texts" to
                DiscordShape(
                    owner = "com.discord.ShapeOwner",
                    member = "field",
                    static = false,
                    type = "java.lang.String",
                    count = 2,
                    pick = "all",
                ),
            "three" to
                DiscordShape(
                    owner = "com.discord.ShapeOwner",
                    member = "field",
                    static = false,
                    type = "java.lang.String",
                    count = 3,
                    pick = "all",
                ),
        )

        assertEquals(listOf("author", "id"), shapes.shapeFields("texts").map { it.name }.sorted())
        val failure = assertThrows(IllegalStateException::class.java) { shapes.shapeFields("three") }
        assertTrue(failure.message!!.contains("expected 3"))
    }

    @Test
    fun picksTheMethodWithTheMostParametersAmongInstanceMethods() {
        val shapes = shapes(
            "bind" to DiscordShape(
                owner = "com.discord.ShapeOwner",
                member = "method",
                static = false,
                firstParameter = "com.discord.ShapeHost",
                pick = "most-parameters",
            ),
        )

        assertEquals(3, shapes.shapeMethod("bind").parameterCount)
    }

    @Test
    fun matchesReturnTypesAHostCanBeAssignedToExceptObject() {
        fun returning(name: String?) = DiscordShape(
            owner = "com.discord.ShapeOwner",
            member = "method",
            name = name,
            parameterCount = 0,
            returnsAssignableFrom = "com.discord.ShapeHost",
            pick = "only",
        )
        val shapes = shapes(
            "base" to returning("base"),
            "contract" to returning("contract"),
            "object" to returning("anything"),
            "any" to returning(null),
        )

        assertEquals("base", shapes.shapeMethod("base").name)
        assertEquals("contract", shapes.shapeMethod("contract").name)
        assertTrue(assertThrows(IllegalStateException::class.java) { shapes.shapeMethod("object") }.message!!.contains("has no method"))
        assertTrue(assertThrows(IllegalStateException::class.java) { shapes.shapeMethod("any") }.message!!.contains("ambiguous"))
    }

    @Test
    fun matchesFieldTypesAssignableToAnInterface() {
        val shapes = shapes(
            "comparable" to DiscordShape(
                owner = "com.discord.ShapeOwner",
                member = "field",
                static = false,
                typeAssignableTo = "java.lang.Comparable",
                count = 2,
                pick = "all",
            ),
        )

        assertEquals(listOf("author", "id"), shapes.shapeFields("comparable").map { it.name }.sorted())
    }

    @Test
    fun findsTheClassTakenAloneByAMethodThroughItsConstructor() {
        fun surface(
            registry: String,
        ) = DiscordShape(parameterOf = registry, member = "constructor", parameters = listOf("int"), pick = "only")
        val shapes = shapes(
            "surface" to surface("com.discord.ShapeRegistry"),
            "ambiguous" to surface("com.discord.AmbiguousShapeRegistry"),
            "none" to
                DiscordShape(parameterOf = "com.discord.ShapeRegistry", member = "constructor", parameters = listOf("long"), pick = "only"),
        )

        assertEquals(ShapeSurface::class.java, shapes.shapeClass("surface"))
        assertTrue(assertThrows(IllegalStateException::class.java) { shapes.shapeClass("ambiguous") }.message!!.contains("ambiguous"))
        assertTrue(
            assertThrows(IllegalStateException::class.java) { shapes.shapeClass("none") }.message!!
                .contains("No class taken alone by a com.discord.ShapeRegistry method"),
        )
    }

    @Test
    fun looksInTheClassAnotherShapeFinds() {
        val shapes = shapes(
            "owner" to
                DiscordShape(
                    owner = "com.discord.ShapeOwner",
                    member = "constructor",
                    parameters = listOf("int", "java.lang.String"),
                    pick = "only",
                ),
            "count" to DiscordShape(ownerShape = "owner", member = "field", type = "int", pick = "only"),
        )

        assertEquals(ShapeOwner::class.java, shapes.shapeClass("owner"))
        assertEquals("count", shapes.shapeField("count").name)
    }

    @Test
    fun failsClearlyForMissingClassesUnknownShapesAndOtherMembers() {
        val shapes = shapes(
            "missing" to DiscordShape(owner = "com.discord.Missing", member = "field", pick = "only"),
            "method" to DiscordShape(owner = "com.discord.ShapeOwner", member = "method", name = "bind", parameterCount = 2, pick = "only"),
            "none" to DiscordShape(owner = "com.discord.ShapeOwner", member = "field", type = "long", pick = "only"),
        )

        assertTrue(
            assertThrows(IllegalStateException::class.java) {
                shapes.shapeField("missing")
            }.message!!.contains("com.discord.Missing"),
        )
        assertThrows(IllegalArgumentException::class.java) { shapes.shapeField("unknown") }
        assertThrows(IllegalArgumentException::class.java) { shapes.shapeField("method") }
        assertTrue(assertThrows(IllegalStateException::class.java) { shapes.shapeField("none") }.message!!.contains("has no field"))
    }

    @Test
    fun bundlesEveryRuleFromTheSharedJson() {
        assertTrue(DISCORD_SHAPE_RULES.keys.containsAll(listOf("messageBind", "reactSurface", "reactSurfaceViewFactory")))
        DISCORD_SHAPE_RULES.values.forEach { rule ->
            assertTrue(rule.member in setOf("field", "method", "constructor"))
            assertTrue(rule.pick in setOf("only", "most-parameters", "all"))
        }
    }
}
