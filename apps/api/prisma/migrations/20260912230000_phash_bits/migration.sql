-- Make the duplicate-photograph check exact, and possible to run at state scale.
--
-- It previously read up to 5000 rows out of the table with no ORDER BY and
-- compared them in the application. Two things were wrong with that. An
-- unordered LIMIT returns an arbitrary subset, so past five thousand hashed
-- photographs the check examined a lottery rather than the record; and at the
-- scale this platform is for — 130,000 schools — that subset is a rounding
-- error against the whole, so the flag would keep reporting "no duplicates"
-- while detecting essentially nothing. A control that silently stops working is
-- worse than one that was never built, because the officer trusts it.
--
-- PostgreSQL can compute the Hamming distance itself: `bit_count(a # b)` on two
-- bit strings, no extension required. Doing it in SQL means the comparison
-- covers every row, transfers nothing, and runs at C speed instead of pulling
-- five thousand rows into Node to compare them one at a time.
--
-- The bit form is a generated column rather than a second field the application
-- writes, so the two representations cannot drift: there is no code path that
-- can set the hash and forget the bits.
ALTER TABLE "media_assets"
  ADD COLUMN "perceptualBits" bit(64)
  GENERATED ALWAYS AS (('x' || "perceptualHash")::bit(64)) STORED;

-- Narrows the scan to hashed, attached rows. It cannot accelerate an arbitrary
-- Hamming distance — no stock index can — but it keeps the sequential part to
-- the photographs that are actually candidates rather than every upload ever.
CREATE INDEX "media_assets_phash_bits" ON "media_assets" ("attachedAt")
  WHERE "perceptualBits" IS NOT NULL AND "attachedAt" IS NOT NULL;
