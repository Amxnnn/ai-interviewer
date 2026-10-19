import type { ParsedResume } from "./schema";

// The rule this file exists for: use the LLM for fuzzy work (reading messy
// text, normalizing "Mar '23" to 2023-03) and code for exact work. Models
// don't know today's date and are unreliable at arithmetic. Code is exact,
// instant and free.

const toMonthIndex = (yearMonth: string) => {
  const [year, month] = yearMonth.split("-").map(Number);
  return year * 12 + (month - 1);
};

/**
 * Total professional experience in years, to one decimal place.
 * Overlapping roles are merged first so two concurrent jobs aren't double-counted.
 */
export function totalYearsOfExperience(experience: ParsedResume["experience"], now = new Date()): number | null {
  const currentMonth = now.getFullYear() * 12 + now.getMonth();

  const intervals = experience
    .flatMap((job): [number, number][] => {
      if (!job.start) return [];
      const end = job.current ? currentMonth : job.end ? toMonthIndex(job.end) : null;
      if (end === null) return [];
      const start = toMonthIndex(job.start);
      return start <= end ? [[start, end]] : [];
    })
    .sort((a, b) => a[0] - b[0]);

  if (intervals.length === 0) return null;

  // Classic "merge intervals": walk in start order, extending the current run
  // while roles overlap, and banking its length when a gap appears.
  let months = 0;
  let [runStart, runEnd] = intervals[0];
  for (const [start, end] of intervals.slice(1)) {
    if (start <= runEnd) {
      runEnd = Math.max(runEnd, end);
    } else {
      months += runEnd - runStart + 1;
      [runStart, runEnd] = [start, end];
    }
  }
  months += runEnd - runStart + 1;

  return Math.round((months / 12) * 10) / 10;
}
