// Deterministic (non-AI) reading of weekday constraints from a client's own
// words, plus the validator that checks generated calendar entries against
// them before anything is persisted. This exists because relying only on
// the model to both understand "lunes a viernes" AND correctly reflect it in
// a tool call is not enough — a real bug shipped from exactly that gap (see
// CAMBIO 07): when the model's own `weekdays` array came back shorter than
// its own `frequencyPerWeek`, the old padding fallback filled the rest from
// a fixed pattern that happened to include Sunday before Tuesday/Thursday/
// Saturday, silently reintroducing a day the client had explicitly excluded.
// Fixing the prompt alone can't guarantee this never recurs — only code that
// re-reads the client's literal text and rejects anything that violates it
// can.

// 0=domingo..6=sábado, same convention as Date#getUTCDay() and the rest of
// the planning code (PlanningBrief.weekdays, getDatesForWeekdays, etc).
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

// Monday-first order for resolving ranges like "viernes a lunes" the way a
// person means them (wrapping through the weekend), not the numeric 0-6
// order where that same range would run backwards.
const WEEK_ORDER: Weekday[] = [1, 2, 3, 4, 5, 6, 0];

const DAY_NAMES: Record<string, Weekday> = {
  domingo: 0,
  domingos: 0,
  sunday: 0,
  sundays: 0,
  lunes: 1,
  monday: 1,
  mondays: 1,
  martes: 2,
  tuesday: 2,
  tuesdays: 2,
  miércoles: 3,
  miercoles: 3,
  wednesday: 3,
  wednesdays: 3,
  jueves: 4,
  thursday: 4,
  thursdays: 4,
  viernes: 5,
  friday: 5,
  fridays: 5,
  sábado: 6,
  sabado: 6,
  sábados: 6,
  sabados: 6,
  saturday: 6,
  saturdays: 6,
};

const DAY_NAME_PATTERN = Object.keys(DAY_NAMES)
  .sort((a, b) => b.length - a.length)
  .join("|");

function normalize(text: string): string {
  return text.toLowerCase();
}

function walkRange(from: Weekday, to: Weekday): Weekday[] {
  const startIndex = WEEK_ORDER.indexOf(from);
  const endIndex = WEEK_ORDER.indexOf(to);
  const out: Weekday[] = [];
  let i = startIndex;
  // Inclusive walk from `from` to `to`, wrapping around the week if `to`
  // comes before `from` in Monday-first order (e.g. "viernes a lunes").
  for (let steps = 0; steps <= 6; steps += 1) {
    out.push(WEEK_ORDER[i]);
    if (i === endIndex) break;
    i = (i + 1) % 7;
  }
  return out;
}

// Reads explicit day RANGES ("lunes a viernes", "monday to friday") and
// explicit day LISTS ("lunes, miércoles y viernes") straight out of the raw
// text. Returns the allowed set when either shows up, or null when neither
// does (meaning: no explicit day-level signal — the caller should fall back
// to whatever the model inferred, uncontested).
export function detectExplicitAllowedWeekdays(text: string): Set<Weekday> | null {
  const normalized = normalize(text);
  const rangePattern = new RegExp(
    `\\b(${DAY_NAME_PATTERN})\\b\\s*(?:a|al|hasta|to|through|-)\\s*\\b(${DAY_NAME_PATTERN})\\b`,
    "gi",
  );
  const rangeMatches = [...normalized.matchAll(rangePattern)];
  if (rangeMatches.length) {
    const allowed = new Set<Weekday>();
    for (const match of rangeMatches) {
      const from = DAY_NAMES[match[1]];
      const to = DAY_NAMES[match[2]];
      if (from === undefined || to === undefined) continue;
      for (const day of walkRange(from, to)) allowed.add(day);
    }
    if (allowed.size) return allowed;
  }

  // A comma/"y"/"and"-separated list of at least two day names with no
  // range word between them, e.g. "lunes, miércoles y viernes" — collected
  // from every distinct day-name occurrence in the message when there are
  // at least two and no range already matched above (a range takes
  // precedence over being re-read as a loose list).
  const nameMatches = [...normalized.matchAll(new RegExp(`\\b(${DAY_NAME_PATTERN})\\b`, "gi"))];
  if (nameMatches.length >= 2) {
    const allowed = new Set<Weekday>();
    for (const match of nameMatches) allowed.add(DAY_NAMES[match[1]]);
    if (allowed.size >= 2) return allowed;
  }
  return null;
}

// Reads explicit EXCLUSION phrases ("no publiques domingos", "sin fines de
// semana", "entre semana", "no weekends", "weekdays only") that name what to
// leave out rather than what to include. Independent of
// detectExplicitAllowedWeekdays — a client can say "lunes a viernes" (an
// allow-list) or "sin domingos" (an exclude-list) or both.
export function detectExplicitExcludedWeekdays(text: string): Set<Weekday> {
  const normalized = normalize(text);
  const excluded = new Set<Weekday>();
  if (
    /\b(sin|no)\b[^.]{0,20}\bfin(?:es)? de semana\b/.test(normalized) ||
    /\bentre semana\b/.test(normalized) ||
    /\bno\s+weekends?\b/.test(normalized) ||
    /\bweekdays?\s+only\b/.test(normalized)
  ) {
    excluded.add(0);
    excluded.add(6);
  }
  for (const [name, day] of Object.entries(DAY_NAMES)) {
    const escaped = name.replace(/[áéíóú]/g, (c) => c);
    const excludePattern = new RegExp(
      `\\b(?:sin|no publiques?|no)\\b[^.]{0,15}\\b${escaped}\\b`,
      "i",
    );
    if (excludePattern.test(normalized)) excluded.add(day);
  }
  return excluded;
}

// Combines both signals into the single set of days a plan is actually
// allowed to land on. Returns null when the text carries no explicit
// day-level signal at all — the caller keeps whatever it already had
// (typically the model's own inference, or a client's earlier turn).
export function detectAllowedWeekdaysFromConversation(
  messages: { role: "user" | "assistant"; content: string }[],
): Set<Weekday> | null {
  const userText = messages
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join("\n");
  if (!userText.trim()) return null;
  const explicitAllowed = detectExplicitAllowedWeekdays(userText);
  const explicitExcluded = detectExplicitExcludedWeekdays(userText);
  if (!explicitAllowed && !explicitExcluded.size) return null;
  const base = explicitAllowed ?? new Set<Weekday>([0, 1, 2, 3, 4, 5, 6]);
  for (const day of explicitExcluded) base.delete(day);
  return base;
}

// The deterministic gate before persistence: given the entries a model
// proposed and the (possibly null — meaning "no explicit constraint given")
// allowed-weekday set, splits them into what may be saved and what must not
// be. NEVER call this only to log the violation and save anyway — a
// violation here means the entry is dropped from what gets persisted.
export function validatePlanningConstraints<T extends { date: string }>(
  entries: T[],
  constraints: { allowedWeekdays: Set<Weekday> | null },
): { valid: T[]; violations: T[] } {
  if (!constraints.allowedWeekdays) return { valid: entries, violations: [] };
  const valid: T[] = [];
  const violations: T[] = [];
  for (const entry of entries) {
    const weekday = new Date(`${entry.date}T00:00:00.000Z`).getUTCDay() as Weekday;
    if (constraints.allowedWeekdays.has(weekday)) valid.push(entry);
    else violations.push(entry);
  }
  return { valid, violations };
}

// CAMBIO 15 — the same class of bug as CAMBIO 07, but for formats instead of
// weekdays: a client could confirm "carrusel" as part of the plan (shown
// back in "Esto entendí") and still get a generated month with zero
// carousels, because format compliance was only ever a soft line in a free-
// text prompt ("Formatos prioritarios: ...") with nothing downstream
// checking the model actually honored it. Kept independent of
// CalendarFormat in wit-chat.server.ts (same "plain client-side type" split
// already used for PlanningBrief/CalendarEntryDraft across this codebase)
// to avoid a server-to-server circular import between the two modules.
export type CalendarFormat = "imagen" | "video" | "carrusel";

const FORMAT_PATTERNS: Record<CalendarFormat, RegExp> = {
  imagen: /\bimágenes?\b|\bimagenes?\b|\bfotos?\b|\bimages?\b|\bphotos?\b/i,
  video: /\bvideos?\b|\breels?\b/i,
  carrusel: /\bcarruseles?\b|\bcarousels?\b/i,
};

// Reads explicit format mentions straight out of the client's own words —
// independent of whatever a model's structured extraction claims. Returns
// null when the client's text carries no format-level signal at all
// (meaning: no explicit constraint — the caller should offer/keep the
// recommended strategic mix, never silently narrow it).
export function detectExplicitFormatsFromConversation(
  messages: { role: "user" | "assistant"; content: string }[],
): Set<CalendarFormat> | null {
  const userText = messages
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join("\n");
  if (!userText.trim()) return null;
  const found = new Set<CalendarFormat>();
  for (const format of Object.keys(FORMAT_PATTERNS) as CalendarFormat[]) {
    if (FORMAT_PATTERNS[format].test(userText)) found.add(format);
  }
  return found.size ? found : null;
}

// Once formats are a hard constraint (the client picked/confirmed specific
// formats, not "mezcla recomendada"), every one of them must actually land
// on the calendar — round-robin assignment guarantees that deterministically
// instead of leaving it to a generator's free-text interpretation of
// "prioritize these formats", which is exactly what let a confirmed format
// silently disappear from a generated month.
export function assignFormatsToDates(
  dates: string[],
  formats: CalendarFormat[],
): Record<string, CalendarFormat> {
  const map: Record<string, CalendarFormat> = {};
  if (!formats.length) return map;
  dates.forEach((date, index) => {
    map[date] = formats[index % formats.length];
  });
  return map;
}

// The format counterpart of validatePlanningConstraints: given a required
// date→format assignment (or null — no hard format constraint), splits
// generated entries into those that honored their assigned format and those
// that didn't. A violation must be regenerated for that date, never
// persisted as-is with the wrong format.
export function validatePlanningFormats<T extends { date: string; format: CalendarFormat }>(
  entries: T[],
  formatByDate: Record<string, CalendarFormat> | null,
): { valid: T[]; violations: T[] } {
  if (!formatByDate) return { valid: entries, violations: [] };
  const valid: T[] = [];
  const violations: T[] = [];
  for (const entry of entries) {
    const required = formatByDate[entry.date];
    if (!required || entry.format === required) valid.push(entry);
    else violations.push(entry);
  }
  return { valid, violations };
}
