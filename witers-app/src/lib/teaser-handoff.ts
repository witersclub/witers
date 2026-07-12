// Hands off the answers from the anonymous homepage teaser (PruebaInteractiva
// in index.tsx) to the real member chat in panel.tsx, across signup +
// checkout — there's no user account yet when those questions are answered,
// so this rides in localStorage rather than the server. Best-effort only:
// if it's missing (different device, cleared storage, private browsing),
// the panel chat just starts fresh with no loss beyond re-asking those few
// questions.
const KEY = "wit_teaser_answers";

export function saveTeaserAnswers(answers: Record<string, string>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(answers));
  } catch {
    // Never let this block the "crear cuenta" navigation.
  }
}

// Reads and clears in one step — meant to be called at most once, right
// when the panel's first-ever chat opens, so a second chat later in the
// same session doesn't also inherit these answers.
export function consumeTeaserAnswers(): Record<string, string> | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    localStorage.removeItem(KEY);
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as Record<string, string>;
  } catch {
    return null;
  }
}
