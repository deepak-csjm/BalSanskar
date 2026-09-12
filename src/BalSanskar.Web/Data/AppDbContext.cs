using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace BalSanskar.Web.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options)
    : IdentityDbContext<AppUser>(options)
{
    public DbSet<ClassSession> Sessions => Set<ClassSession>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        base.OnModelCreating(b);

        b.Entity<ClassSession>(e =>
        {
            e.Property(x => x.Theme).HasMaxLength(120).IsRequired();
            e.Property(x => x.Story).HasMaxLength(4000);
            e.Property(x => x.Activity).HasMaxLength(4000);
            e.Property(x => x.HomePractice).HasMaxLength(2000);
            e.Property(x => x.TeacherNote).HasMaxLength(4000);
            e.Property(x => x.TaughtBy).HasMaxLength(120).IsRequired();

            // The journal is almost always read newest-first.
            e.HasIndex(x => x.Date).IsDescending();
        });
    }
}
