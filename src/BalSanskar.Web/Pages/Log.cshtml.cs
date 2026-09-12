using System.ComponentModel.DataAnnotations;
using BalSanskar.Web.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;

namespace BalSanskar.Web.Pages;

public class LogModel(AppDbContext db, UserManager<AppUser> userManager) : PageModel
{
    [BindProperty]
    public InputModel Input { get; set; } = new();

    public string? Error { get; set; }
    public bool IsEdit => Input.Id != 0;
    public int? ReusedFrom { get; private set; }

    public class InputModel
    {
        public int Id { get; set; }

        [Required]
        [DataType(DataType.Date)]
        public DateOnly Date { get; set; } = DateOnly.FromDateTime(DateTime.Today);

        [Required(ErrorMessage = "A theme is needed — everything else is optional.")]
        [StringLength(120)]
        public string Theme { get; set; } = "";

        [StringLength(4000)] public string? Story { get; set; }
        [StringLength(4000)] public string? Activity { get; set; }
        [StringLength(2000)] public string? HomePractice { get; set; }
        [StringLength(4000)] public string? TeacherNote { get; set; }
    }

    /// <param name="id">Edit this session.</param>
    /// <param name="from">Start a new session prefilled from this one.</param>
    public async Task<IActionResult> OnGetAsync(int? id = null, int? from = null)
    {
        if (id is not null)
        {
            var existing = await db.Sessions.AsNoTracking().FirstOrDefaultAsync(s => s.Id == id);
            if (existing is null) return NotFound();
            Input = ToInput(existing, keepId: true);
            return Page();
        }

        if (from is not null)
        {
            var source = await db.Sessions.AsNoTracking().FirstOrDefaultAsync(s => s.Id == from);
            if (source is null) return NotFound();
            Input = ToInput(source, keepId: false);
            // A reused plan is being run again today, not on the original date.
            Input.Date = DateOnly.FromDateTime(DateTime.Today);
            // The previous teacher's candid note belongs to that sitting, not this one.
            Input.TeacherNote = null;
            ReusedFrom = from;
        }

        return Page();
    }

    public async Task<IActionResult> OnPostAsync()
    {
        if (!ModelState.IsValid) return Page();

        var user = await userManager.GetUserAsync(User);
        if (user is null) return Forbid();

        ClassSession session;

        if (Input.Id != 0)
        {
            var existing = await db.Sessions.FirstOrDefaultAsync(s => s.Id == Input.Id);
            if (existing is null) return NotFound();
            session = existing;
            session.UpdatedAtUtc = DateTimeOffset.UtcNow;
        }
        else
        {
            session = new ClassSession
            {
                TaughtBy = string.IsNullOrWhiteSpace(user.DisplayName) ? (user.Email ?? "A teacher") : user.DisplayName,
                TaughtByUserId = user.Id,
            };
            db.Sessions.Add(session);
        }

        session.Date = Input.Date;
        session.Theme = Input.Theme.Trim();
        session.Story = Blank(Input.Story);
        session.Activity = Blank(Input.Activity);
        session.HomePractice = Blank(Input.HomePractice);
        session.TeacherNote = Blank(Input.TeacherNote);

        await db.SaveChangesAsync();

        return RedirectToPage("/Session", new { id = session.Id });
    }

    private static string? Blank(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static InputModel ToInput(ClassSession s, bool keepId) => new()
    {
        Id = keepId ? s.Id : 0,
        Date = s.Date,
        Theme = s.Theme,
        Story = s.Story,
        Activity = s.Activity,
        HomePractice = s.HomePractice,
        TeacherNote = s.TeacherNote,
    };
}
