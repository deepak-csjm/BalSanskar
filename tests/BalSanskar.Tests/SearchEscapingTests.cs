using BalSanskar.Web.Pages;

namespace BalSanskar.Tests;

/// <summary>
/// The journal search uses SQL LIKE so it stays case-insensitive on SQLite,
/// which means the teacher's own wildcards have to be neutralised or a search
/// for "%" would return the entire journal.
/// </summary>
public class SearchEscapingTests
{
    [Theory]
    [InlineData("honesty", "honesty")]
    [InlineData("100%", @"100\%")]
    [InlineData("a_b", @"a\_b")]
    [InlineData(@"back\slash", @"back\\slash")]
    [InlineData("%_%", @"\%\_\%")]
    public void Escapes_like_wildcards(string input, string expected)
        => Assert.Equal(expected, IndexModel.EscapeLike(input));

    [Fact]
    public void Escapes_the_escape_character_before_the_wildcards()
    {
        // A naive implementation that escapes % first would double-escape the
        // backslash it just inserted and break the pattern.
        Assert.Equal(@"\\\%", IndexModel.EscapeLike(@"\%"));
    }
}
