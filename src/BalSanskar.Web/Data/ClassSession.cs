namespace BalSanskar.Web.Data;

/// <summary>
/// One class meeting, written up by whoever taught it.
///
/// Deliberately holds NO information about the children who attended.
/// See docs/decisions.md — storing minors' personal data would put the
/// group under DPDP Act 2023 / GDPR Art. 8 consent obligations that a
/// volunteer-run class cannot realistically meet, for data nobody reads.
/// </summary>
public class ClassSession
{
    public int Id { get; set; }

    /// <summary>The day the class was held.</summary>
    public DateOnly Date { get; set; }

    /// <summary>The value or idea explored, e.g. "Honesty". The one required field.</summary>
    public string Theme { get; set; } = "";

    /// <summary>Story, reading or example used to open the theme.</summary>
    public string? Story { get; set; }

    /// <summary>What the children actually did — craft, role-play, discussion.</summary>
    public string? Activity { get; set; }

    /// <summary>The one thing parents are asked to reinforce during the week.</summary>
    public string? HomePractice { get; set; }

    /// <summary>
    /// Candid note for whoever teaches next — what worked, what fell flat.
    /// Never included in the parent recap.
    /// </summary>
    public string? TeacherNote { get; set; }

    /// <summary>Display name of the teacher, copied at write time so the
    /// history stays readable even if the account is later removed.</summary>
    public string TaughtBy { get; set; } = "";

    public string? TaughtByUserId { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? UpdatedAtUtc { get; set; }
}
