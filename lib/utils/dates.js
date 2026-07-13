const MONTHS = {
  january: 0,
  jan: 0,
  february: 1,
  feb: 1,
  march: 2,
  mar: 2,
  april: 3,
  apr: 3,
  may: 4,
  june: 5,
  jun: 5,
  july: 6,
  jul: 6,
  august: 7,
  aug: 7,
  september: 8,
  sep: 8,
  sept: 8,
  october: 9,
  oct: 9,
  november: 10,
  nov: 10,
  december: 11,
  dec: 11,
};

const WEEKDAYS = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function createValidDate(year, month, day) {
  const date = new Date(year, month, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function getNextWeekdayDate(currentDate, weekdayNumber) {
  const result = new Date(currentDate);

  let daysUntilNext = (weekdayNumber - result.getDay() + 7) % 7;

  if (daysUntilNext === 0) {
    daysUntilNext = 7;
  }

  result.setDate(result.getDate() + daysUntilNext);

  return result;
}

export function getTomorrowDate() {
  return formatDate(addDays(new Date(), 1));
}

export function todayDate() {
  return formatDate(new Date());
}

export function parseDueDateFromPrompt(prompt) {
  const originalPrompt = String(prompt || "").trim();
  const normalisedPrompt = originalPrompt.toLowerCase();
  const today = new Date();

  if (!normalisedPrompt) {
    return null;
  }

  /*
   * ISO format:
   * 2026-07-20
   */
  const isoMatch = normalisedPrompt.match(
    /\b(20\d{2})-(0[1-9]|1[0-2])-([0-2]\d|3[01])\b/
  );

  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]) - 1;
    const day = Number(isoMatch[3]);

    const date = createValidDate(year, month, day);

    return date ? formatDate(date) : null;
  }

  /*
   * UK format:
   * 20/07/2026
   * 20-07-2026
   */
  const ukDateMatch = normalisedPrompt.match(
    /\b([0-2]?\d|3[01])[/-](0?\d|1[0-2])[/-](20\d{2})\b/
  );

  if (ukDateMatch) {
    const day = Number(ukDateMatch[1]);
    const month = Number(ukDateMatch[2]) - 1;
    const year = Number(ukDateMatch[3]);

    const date = createValidDate(year, month, day);

    return date ? formatDate(date) : null;
  }

  /*
   * Written UK dates:
   * 20 July 2026
   * 20th July 2026
   * July 20 2026
   */
  const dayMonthYearMatch = normalisedPrompt.match(
    /\b([0-2]?\d|3[01])(?:st|nd|rd|th)?\s+([a-z]+)\s+(20\d{2})\b/
  );

  if (dayMonthYearMatch) {
    const day = Number(dayMonthYearMatch[1]);
    const month = MONTHS[dayMonthYearMatch[2]];
    const year = Number(dayMonthYearMatch[3]);

    if (month !== undefined) {
      const date = createValidDate(year, month, day);

      return date ? formatDate(date) : null;
    }
  }

  const monthDayYearMatch = normalisedPrompt.match(
    /\b([a-z]+)\s+([0-2]?\d|3[01])(?:st|nd|rd|th)?[,]?\s+(20\d{2})\b/
  );

  if (monthDayYearMatch) {
    const month = MONTHS[monthDayYearMatch[1]];
    const day = Number(monthDayYearMatch[2]);
    const year = Number(monthDayYearMatch[3]);

    if (month !== undefined) {
      const date = createValidDate(year, month, day);

      return date ? formatDate(date) : null;
    }
  }

  /*
   * Relative dates.
   */
  if (
    normalisedPrompt.includes("day after tomorrow") ||
    normalisedPrompt.includes("in two days") ||
    normalisedPrompt.includes("in 2 days")
  ) {
    return formatDate(addDays(today, 2));
  }

  if (normalisedPrompt.includes("tomorrow")) {
    return formatDate(addDays(today, 1));
  }

  if (normalisedPrompt.includes("today")) {
    return formatDate(today);
  }

  if (
    normalisedPrompt.includes("after one week") ||
    normalisedPrompt.includes("in one week") ||
    normalisedPrompt.includes("next week")
  ) {
    return formatDate(addDays(today, 7));
  }

  if (
    normalisedPrompt.includes("after two weeks") ||
    normalisedPrompt.includes("in two weeks")
  ) {
    return formatDate(addDays(today, 14));
  }

  /*
   * Examples:
   * in 7 days
   * after 10 days
   */
  const daysMatch = normalisedPrompt.match(
    /\b(?:in|after)\s+(\d+)\s+days?\b/
  );

  if (daysMatch) {
    return formatDate(addDays(today, Number(daysMatch[1])));
  }

  /*
   * Examples:
   * in 3 weeks
   * after 2 weeks
   */
  const weeksMatch = normalisedPrompt.match(
    /\b(?:in|after)\s+(\d+)\s+weeks?\b/
  );

  if (weeksMatch) {
    return formatDate(addDays(today, Number(weeksMatch[1]) * 7));
  }

  /*
   * Examples:
   * next Monday
   * next Friday
   */
  const weekdayMatch = normalisedPrompt.match(
    /\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/
  );

  if (weekdayMatch) {
    const weekdayNumber = WEEKDAYS[weekdayMatch[1]];

    return formatDate(getNextWeekdayDate(today, weekdayNumber));
  }

  return null;
}

export function removeDatePhraseFromText(text) {
  return String(text || "")
    .replace(
      /\b(20\d{2})-(0[1-9]|1[0-2])-([0-2]\d|3[01])\b/gi,
      ""
    )
    .replace(
      /\b([0-2]?\d|3[01])[/-](0?\d|1[0-2])[/-](20\d{2})\b/gi,
      ""
    )
    .replace(
      /\b([0-2]?\d|3[01])(?:st|nd|rd|th)?\s+[a-z]+\s+20\d{2}\b/gi,
      ""
    )
    .replace(
      /\b[a-z]+\s+([0-2]?\d|3[01])(?:st|nd|rd|th)?[,]?\s+20\d{2}\b/gi,
      ""
    )
    .replace(/\bday after tomorrow\b/gi, "")
    .replace(/\btomorrow\b/gi, "")
    .replace(/\btoday\b/gi, "")
    .replace(/\bnext week\b/gi, "")
    .replace(/\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, "")
    .replace(/\b(?:in|after)\s+(?:one|two|\d+)\s+(?:day|days|week|weeks)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}
