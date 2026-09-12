using System.Globalization;
using System.Text;
using BalSanskar.Web.Data;
using BalSanskar.Web.Options;

namespace BalSanskar.Web.Services;

/// <summary>
/// Turns a session write-up into a message a teacher can paste straight into
/// the parents' WhatsApp group.
///
/// This is the reason the app exists. Logging a session has a delayed payoff
/// (a reusable plan bank, months from now); the recap is the payoff that
/// arrives the same minute, which is what makes anyone bother logging at all.
///
/// Pure and static on purpose: the whole thing is covered by unit tests
/// without a database or a browser.
/// </summary>
public static class RecapBuilder
{
    // WhatsApp renders *text* as bold.
    private const string Bold = "*";

    public static string Build(ClassSession session, GroupOptions group)
    {
        ArgumentNullException.ThrowIfNull(session);
        ArgumentNullException.ThrowIfNull(group);

        var blocks = new List<string>();

        if (Has(group.Greeting))
            blocks.Add($"{group.Greeting.Trim()} \U0001F64F");

        blocks.Add(Header(session, group));

        var inClass = new List<string>();
        if (Has(session.Story))
            inClass.Add($"\U0001F4D6 Story — {Clean(session.Story)}");
        if (Has(session.Activity))
            inClass.Add($"\U0001F3A8 In class — {Clean(session.Activity)}");
        if (inClass.Count > 0)
            blocks.Add(string.Join("\n", inClass));

        // The ask. Given its own block so it does not get lost in a wall of text.
        if (Has(session.HomePractice))
            blocks.Add($"\U0001F3E0 {Bold}At home this week{Bold}\n{Clean(session.HomePractice)}");

        // session.TeacherNote is deliberately never included: it is candid
        // feedback for the next volunteer, not something to show parents.

        return string.Join("\n\n", blocks);
    }

    private static string Header(ClassSession session, GroupOptions group)
    {
        var date = session.Date.ToString("ddd, d MMM yyyy", CultureInfo.InvariantCulture);
        var sb = new StringBuilder();

        if (Has(group.Name))
            sb.Append(Bold).Append(group.Name.Trim()).Append(Bold).Append(" · ");

        sb.Append(date);

        if (Has(session.Theme))
            sb.Append('\n').Append("Today we explored ").Append(Bold).Append(Clean(session.Theme)).Append(Bold).Append('.');

        return sb.ToString();
    }

    private static bool Has(string? value) => !string.IsNullOrWhiteSpace(value);

    /// <summary>Trims and normalises line endings without destroying the
    /// teacher's own paragraph breaks.</summary>
    private static string Clean(string? value) =>
        value is null ? "" : value.Replace("\r\n", "\n").Replace('\r', '\n').Trim();
}
