import type { ChildAgeBand } from "../schemas/child-profiles.schemas.js";

export const MAX_CHILD_AGE_MONTHS = 216;

export type ChildAgeSource = {
  ageBand: ChildAgeBand;
  ageMonths: number | null;
  ageAsOfDate: Date | null;
  birthMonth: number | null;
  birthYear: number | null;
};

export type ChildAgePatch = {
  ageBand?: ChildAgeBand | undefined;
  ageMonths?: number | null | undefined;
  birthMonth?: number | null | undefined;
  birthYear?: number | null | undefined;
};

export function resolveChildAgeSnapshot(
  source: ChildAgeSource,
  now: Date = new Date()
): { ageBand: ChildAgeBand; ageMonths: number | null } {
  const ageMonths = resolveCurrentChildAgeMonths(source, now);

  return {
    ageBand: ageMonths === null ? source.ageBand : deriveChildAgeBand(ageMonths),
    ageMonths
  };
}

export function resolveCurrentChildAgeMonths(
  source: Pick<
    ChildAgeSource,
    "ageMonths" | "ageAsOfDate" | "birthMonth" | "birthYear"
  >,
  now: Date = new Date()
): number | null {
  if (source.birthMonth !== null && source.birthYear !== null) {
    const currentMonthIndex = now.getUTCFullYear() * 12 + now.getUTCMonth();
    const birthMonthIndex = source.birthYear * 12 + (source.birthMonth - 1);

    return clampAgeMonths(currentMonthIndex - birthMonthIndex);
  }

  if (source.ageMonths === null) {
    return null;
  }

  const elapsedMonths = source.ageAsOfDate
    ? completedCalendarMonths(source.ageAsOfDate, now)
    : 0;

  return clampAgeMonths(source.ageMonths + elapsedMonths);
}

export function buildChildAgeStorageValues(
  input: {
    ageBand: ChildAgeBand;
    ageMonths?: number | null | undefined;
    birthMonth?: number | null | undefined;
    birthYear?: number | null | undefined;
  },
  now: Date = new Date()
): ChildAgeSource {
  if (
    input.birthMonth !== undefined &&
    input.birthMonth !== null &&
    input.birthYear !== undefined &&
    input.birthYear !== null
  ) {
    const currentAgeMonths = resolveCurrentChildAgeMonths(
      {
        ageMonths: null,
        ageAsOfDate: null,
        birthMonth: input.birthMonth,
        birthYear: input.birthYear
      },
      now
    );

    return {
      ageBand:
        currentAgeMonths === null
          ? input.ageBand
          : deriveChildAgeBand(currentAgeMonths),
      ageMonths: null,
      ageAsOfDate: null,
      birthMonth: input.birthMonth,
      birthYear: input.birthYear
    };
  }

  if (input.ageMonths !== undefined && input.ageMonths !== null) {
    const ageMonths = clampAgeMonths(input.ageMonths);

    return {
      ageBand: deriveChildAgeBand(ageMonths),
      ageMonths,
      ageAsOfDate: now,
      birthMonth: null,
      birthYear: null
    };
  }

  return {
    ageBand: input.ageBand,
    ageMonths: null,
    ageAsOfDate: null,
    birthMonth: null,
    birthYear: null
  };
}

export function mergeChildAgeStorageValues(
  current: ChildAgeSource,
  patch: ChildAgePatch,
  now: Date = new Date()
): ChildAgeSource {
  const manualAgeChanged = patch.ageMonths !== undefined;
  const birthSourceChanged =
    patch.birthMonth !== undefined || patch.birthYear !== undefined;

  if (patch.ageMonths !== undefined && patch.ageMonths !== null) {
    return buildChildAgeStorageValues(
      {
        ageBand: patch.ageBand ?? current.ageBand,
        ageMonths: patch.ageMonths
      },
      now
    );
  }

  const birthMonth =
    patch.birthMonth !== undefined ? patch.birthMonth : current.birthMonth;
  const birthYear =
    patch.birthYear !== undefined ? patch.birthYear : current.birthYear;

  if (
    birthSourceChanged &&
    birthMonth !== null &&
    birthYear !== null
  ) {
    return buildChildAgeStorageValues(
      {
        ageBand: patch.ageBand ?? current.ageBand,
        birthMonth,
        birthYear
      },
      now
    );
  }

  if (manualAgeChanged || birthSourceChanged) {
    return {
      ageBand: patch.ageBand ?? current.ageBand,
      ageMonths: null,
      ageAsOfDate: null,
      birthMonth: null,
      birthYear: null
    };
  }

  return {
    ...current,
    ageBand: patch.ageBand ?? current.ageBand
  };
}

export function deriveChildAgeBand(ageMonths: number): ChildAgeBand {
  if (ageMonths < 3) return "newborn_0_3";
  if (ageMonths < 6) return "infant_3_6";
  if (ageMonths < 12) return "infant_6_12";
  if (ageMonths < 24) return "toddler_12_24";
  if (ageMonths < 36) return "preschool_24_36";
  return "child_3_plus";
}

export function completedCalendarMonths(start: Date, end: Date): number {
  if (end.getTime() <= start.getTime()) {
    return 0;
  }

  let months =
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (end.getUTCMonth() - start.getUTCMonth());

  const anniversaryDay = Math.min(
    start.getUTCDate(),
    daysInUtcMonth(end.getUTCFullYear(), end.getUTCMonth())
  );

  if (end.getUTCDate() < anniversaryDay) {
    months -= 1;
  }

  return Math.max(0, months);
}

function daysInUtcMonth(year: number, zeroBasedMonth: number): number {
  return new Date(Date.UTC(year, zeroBasedMonth + 1, 0)).getUTCDate();
}

function clampAgeMonths(value: number): number {
  return Math.min(MAX_CHILD_AGE_MONTHS, Math.max(0, value));
}
