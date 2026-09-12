using BalSanskar.Web.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;

namespace BalSanskar.Web.Pages;

public class IndexModel(AppDbContext db) : PageModel
{
    private const string EscapeChar = "\\";

    public IReadOnlyList<ClassSession> Sessions { get; private set; } = [];

    [BindProperty(SupportsGet = true, Name = "q")]
    public string? Query { get; set; }

    public async Task OnGetAsync()
    {
        IQueryable<ClassSession> q = db.Sessions.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(Query))
        {
            // LIKE (not Contains) so the search is case-insensitive on SQLite,
            // with the user's own % and _ escaped so they match literally.
            var pattern = $"%{EscapeLike(Query.Trim())}%";
            q = q.Where(s =>
                EF.Functions.Like(s.Theme, pattern, EscapeChar) ||
                (s.Story != null && EF.Functions.Like(s.Story, pattern, EscapeChar)) ||
                (s.Activity != null && EF.Functions.Like(s.Activity, pattern, EscapeChar)) ||
                (s.HomePractice != null && EF.Functions.Like(s.HomePractice, pattern, EscapeChar)) ||
                (s.TeacherNote != null && EF.Functions.Like(s.TeacherNote, pattern, EscapeChar)));
        }

        Sessions = await q
            .OrderByDescending(s => s.Date)
            .ThenByDescending(s => s.Id)
            .ToListAsync();
    }

    internal static string EscapeLike(string term) => term
        .Replace(EscapeChar, EscapeChar + EscapeChar)
        .Replace("%", EscapeChar + "%")
        .Replace("_", EscapeChar + "_");
}
