import type { ClassLevel as ApiClassLevel } from '@balsanskar/shared';
import { ClassLevel as DbClassLevel } from '@prisma/client';

/**
 * The API speaks `"5"`, the database speaks `CLASS_5`.
 *
 * Postgres enum labels cannot begin with a digit in a way Prisma will accept,
 * but a JSON payload of `"5"` is what a form actually produces. The translation
 * is confined to this module so neither side has to know about the other's
 * constraint.
 */
const TO_DB: Record<ApiClassLevel, DbClassLevel> = {
  BALVATIKA: DbClassLevel.BALVATIKA,
  '1': DbClassLevel.CLASS_1,
  '2': DbClassLevel.CLASS_2,
  '3': DbClassLevel.CLASS_3,
  '4': DbClassLevel.CLASS_4,
  '5': DbClassLevel.CLASS_5,
  '6': DbClassLevel.CLASS_6,
  '7': DbClassLevel.CLASS_7,
  '8': DbClassLevel.CLASS_8,
};

const TO_API = Object.fromEntries(
  Object.entries(TO_DB).map(([api, db]) => [db, api as ApiClassLevel]),
) as Record<DbClassLevel, ApiClassLevel>;

export function toDbClassLevel(value: ApiClassLevel): DbClassLevel {
  return TO_DB[value];
}

export function toApiClassLevel(value: DbClassLevel): ApiClassLevel {
  return TO_API[value];
}

export function toDbClassLevels(values: ApiClassLevel[]): DbClassLevel[] {
  return values.map(toDbClassLevel);
}

export function toApiClassLevels(values: DbClassLevel[]): ApiClassLevel[] {
  return values.map(toApiClassLevel);
}
