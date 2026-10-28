package app.unbound.manager.core

import org.junit.Assert.assertEquals
import org.junit.Test

class NotesTest {
    @Test
    fun `GitHub's generated notes read as plain text`() {
        val markdown = """
            ## What's Changed
            * **fix(loader):** keep `bundle` cache by @someone in https://github.com/o/r/pull/12
            * See [the docs](https://example.com) ![badge](https://img)



            **Full Changelog**: https://github.com/o/r/compare/a...b
        """.trimIndent()

        assertEquals(
            """
            What's Changed
            • fix(loader): keep bundle cache by @someone in https://github.com/o/r/pull/12
            • See the docs badge

            Full Changelog: https://github.com/o/r/compare/a...b
            """.trimIndent(),
            plainText(markdown),
        )
    }
}
