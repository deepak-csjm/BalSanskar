using BalSanskar.Web.Data;
using BalSanskar.Web.Options;
using BalSanskar.Web.Services;

namespace BalSanskar.Tests;

public class RecapBuilderTests
{
    private static GroupOptions Group() => new()
    {
        Name = "Sunday Balvihar",
        Greeting = "Namaste",
    };

    private static ClassSession Session() => new()
    {
        Date = new DateOnly(2026, 9, 12),
        Theme = "Honesty",
        Story = "The woodcutter and the golden axe",
        Activity = "Drew a moment when telling the truth was hard",
        HomePractice = "Ask your child about a time they told the truth even when it was difficult.",
        TeacherNote = "The younger ones lost interest after ten minutes. Shorten it next time.",
        TaughtBy = "Deepak",
    };

    [Fact]
    public void Includes_every_parent_facing_field()
    {
        var recap = RecapBuilder.Build(Session(), Group());

        Assert.Contains("Namaste", recap);
        Assert.Contains("Sunday Balvihar", recap);
        Assert.Contains("Sat, 12 Sep 2026", recap);
        Assert.Contains("Honesty", recap);
        Assert.Contains("The woodcutter and the golden axe", recap);
        Assert.Contains("Drew a moment when telling the truth was hard", recap);
        Assert.Contains("Ask your child about a time", recap);
    }

    [Fact]
    public void Never_leaks_the_teacher_note_to_parents()
    {
        var session = Session();
        var recap = RecapBuilder.Build(session, Group());

        Assert.DoesNotContain("lost interest", recap);
        Assert.DoesNotContain(session.TeacherNote!, recap);
    }

    [Fact]
    public void Works_when_only_the_theme_was_filled_in()
    {
        var sparse = new ClassSession
        {
            Date = new DateOnly(2026, 1, 4),
            Theme = "Gratitude",
            TaughtBy = "Deepak",
        };

        var recap = RecapBuilder.Build(sparse, Group());

        Assert.Contains("Gratitude", recap);
        Assert.Contains("Sun, 4 Jan 2026", recap);
        Assert.DoesNotContain("Story", recap);
        Assert.DoesNotContain("In class", recap);
        Assert.DoesNotContain("At home this week", recap);
        // No stray blank runs from the omitted blocks.
        Assert.DoesNotContain("\n\n\n", recap);
    }

    [Fact]
    public void Omits_the_greeting_when_the_group_has_not_set_one()
    {
        var group = Group();
        group.Greeting = "";

        var recap = RecapBuilder.Build(Session(), group);

        Assert.DoesNotContain("Namaste", recap);
        Assert.StartsWith("*Sunday Balvihar*", recap);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("\n\t ")]
    public void Treats_whitespace_only_fields_as_absent(string blank)
    {
        var session = Session();
        session.Story = blank;
        session.Activity = blank;
        session.HomePractice = blank;

        var recap = RecapBuilder.Build(session, Group());

        Assert.DoesNotContain("Story —", recap);
        Assert.DoesNotContain("In class —", recap);
        Assert.DoesNotContain("At home this week", recap);
        Assert.DoesNotContain("\n\n\n", recap);
    }

    [Fact]
    public void Preserves_paragraph_breaks_the_teacher_typed()
    {
        var session = Session();
        session.HomePractice = "Line one.\r\n\r\nLine two.";

        var recap = RecapBuilder.Build(session, Group());

        Assert.Contains("Line one.\n\nLine two.", recap);
        Assert.DoesNotContain("\r", recap);
    }

    [Fact]
    public void Home_practice_is_its_own_block_so_it_is_not_buried()
    {
        var recap = RecapBuilder.Build(Session(), Group());
        var homeBlock = recap.Split("\n\n").Single(b => b.Contains("At home this week"));

        Assert.DoesNotContain("Story", homeBlock);
        Assert.DoesNotContain("In class", homeBlock);
    }

    [Fact]
    public void Date_format_does_not_drift_with_the_server_locale()
    {
        var original = Thread.CurrentThread.CurrentCulture;
        try
        {
            Thread.CurrentThread.CurrentCulture = new System.Globalization.CultureInfo("hi-IN");
            var recap = RecapBuilder.Build(Session(), Group());
            Assert.Contains("Sat, 12 Sep 2026", recap);
        }
        finally
        {
            Thread.CurrentThread.CurrentCulture = original;
        }
    }

    [Fact]
    public void Rejects_null_arguments()
    {
        Assert.Throws<ArgumentNullException>(() => RecapBuilder.Build(null!, Group()));
        Assert.Throws<ArgumentNullException>(() => RecapBuilder.Build(Session(), null!));
    }
}
