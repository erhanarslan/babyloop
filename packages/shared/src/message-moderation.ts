export type MessageModerationReason =
  | "PROFANITY"
  | "SEXUAL_CONTENT"
  | "THREAT"
  | "SPAM";

export type MessageModerationResult =
  | { allowed: true }
  | { allowed: false; reason: MessageModerationReason };

type NormalizedMessage = {
  compact: string;
  collapsedCompact: string;
  spaced: string;
  collapsedSpaced: string;
  tokens: string[];
};

/**
 * MVP deterministic moderation for obvious abuse.
 *
 * This is intentionally conservative and local-only:
 * - no external service
 * - no LLM call
 * - no DB dependency
 *
 * It should later be augmented with:
 * - AI moderation
 * - human review tools
 * - message moderation event logging
 * - fraud / off-platform payment detection
 */
export function moderateMessageBody(input: string): MessageModerationResult {
  const normalized = normalizeMessage(input);

  if (!normalized.spaced) {
    return { allowed: true };
  }

  if (isSpam(normalized)) {
    return { allowed: false, reason: "SPAM" };
  }

  if (matchesTerms(normalized, PROFANITY_TERMS) || matchesPatterns(normalized, PROFANITY_PATTERNS)) {
    return { allowed: false, reason: "PROFANITY" };
  }

  if (
    matchesTerms(normalized, SEXUAL_CONTENT_TERMS) ||
    matchesPatterns(normalized, SEXUAL_CONTENT_PATTERNS)
  ) {
    return { allowed: false, reason: "SEXUAL_CONTENT" };
  }

  if (matchesPatterns(normalized, THREAT_PATTERNS)) {
    return { allowed: false, reason: "THREAT" };
  }

  return { allowed: true };
}

/**
 * Normalize Turkish/English abusive text variants and common obfuscation:
 * - diacritics
 * - Turkish-specific letters
 * - leetspeak
 * - punctuation between letters
 * - excessive repeated characters
 */
function normalizeMessage(input: string): NormalizedMessage {
  const lower = input.toLocaleLowerCase("tr-TR");

  const withoutDiacritics = lower
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c");

  const deobfuscated = withoutDiacritics
    .replace(/[@]/g, "a")
    .replace(/[!1|]/g, "i")
    .replace(/[3]/g, "e")
    .replace(/[0]/g, "o")
    .replace(/[$5]/g, "s")
    .replace(/[7]/g, "t")
    .replace(/[8]/g, "b")
    .replace(/[9]/g, "g");

  const spaced = deobfuscated
    .replace(/[^a-z0-9:/.\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const compact = spaced.replace(/[^a-z0-9]+/g, "");

  const collapsedSpaced = collapseRepeatedCharacters(spaced);
  const collapsedCompact = collapseRepeatedCharacters(compact);

  return {
    compact,
    collapsedCompact,
    spaced,
    collapsedSpaced,
    tokens: spaced ? spaced.split(" ") : []
  };
}

function collapseRepeatedCharacters(input: string): string {
  return input.replace(/(.)\1{2,}/g, "$1$1");
}

function matchesTerms(normalized: NormalizedMessage, terms: readonly string[]): boolean {
  const tokenSet = new Set(normalized.tokens);

  return terms.some((term) => {
    if (tokenSet.has(term)) {
      return true;
    }

    /**
     * Do not compact-match very short terms.
     *
     * Example:
     * - "sik" inside "bisiklet" would be a false positive.
     * - "anal" inside "analiz" would be a false positive.
     */
    if (term.length < 5) {
      return false;
    }

    return normalized.compact.includes(term) || normalized.collapsedCompact.includes(term);
  });
}

function matchesPatterns(normalized: NormalizedMessage, patterns: readonly RegExp[]): boolean {
  return patterns.some(
    (pattern) => pattern.test(normalized.spaced) || pattern.test(normalized.collapsedSpaced)
  );
}

function isSpam(normalized: NormalizedMessage): boolean {
  if (/(.)\1{9,}/.test(normalized.compact)) {
    return true;
  }

  const urlMatches = normalized.spaced.match(/\b(?:https?:\/\/|www\.)\S+/g) ?? [];

  if (urlMatches.length >= 3) {
    return true;
  }

  const tokenCounts = new Map<string, number>();

  for (const token of normalized.tokens) {
    if (token.length < 2) {
      continue;
    }

    const nextCount = (tokenCounts.get(token) ?? 0) + 1;

    if (nextCount >= 6) {
      return true;
    }

    tokenCounts.set(token, nextCount);
  }

  const repeatedPhrase = normalized.spaced.match(
    /\b([a-z0-9]{2,}(?:\s+[a-z0-9]{2,}){1,3})(?:\s+\1){3,}\b/
  );

  return Boolean(repeatedPhrase);
}

/**
 * Keep short terms exact-token only to avoid false positives.
 * Longer terms are also checked against compact/collapsed text.
 */
const PROFANITY_TERMS = [
  // Turkish common profanity / heavy insult variants
  "amk",
  "amq",
  "aq",
  "mk",
  "oc",
  "orospu",
  "orospucocugu",
  "orosbucocugu",
  "orosbucocu",
  "pic",
  "pust",
  "siktir",
  "sikik",
  "sikeyim",
  "sikerim",
  "siktim",
  "sikis",
  "sik",
  "yarak",
  "yarrak",
  "tasak",
  "got",
  "gotveren",
  "gotlek",
  "gavat",
  "pezevenk",
  "kahpe",
  "surtuk",
  "kaltak",
  "serefsiz",
  "haysiyetsiz",
  "namussuz",
  "adi",
  "pislik",
  "bok",
  "boktan",
  "boku",
  "salak",
  "aptal",
  "gerizekali",
  "gerizekali",
  "embesil",
  "alçak",
  "alcak",
  "it",
  "amina",
  "aminakoyim",
  "aminakoyayim",
  "aminakoyarim",
  "aminasokarim",
  "anan",
  "anani",
  "anasini",

  // English common profanity / heavy insult variants
  "fuck",
  "fucking",
  "fucker",
  "motherfucker",
  "mf",
  "shit",
  "bullshit",
  "asshole",
  "bitch",
  "bastard",
  "cunt",
  "dick",
  "prick",
  "wanker",
  "slut",
  "whore",
  "piss",
  "crap",
  "idiot",
  "moron"
] as const;

const PROFANITY_PATTERNS = [
  // Turkish phrase variants split by spaces after punctuation normalization
  /\ba\s*m\s*k\b/u,
  /\ba\s*q\b/u,
  /\ba\s*m\s*q\b/u,
  /\bo\s*c\b/u,
  /\ba\s*m\s*i\s*n\s*a\b/u,
  /\ba\s*m\s*i\s*n\s*a\s+k\s*o\s*y(?:im|ayim|arim)?\b/u,
  /\ba\s*m\s*i\s*n\s*a\s+s\s*o\s*k(?:arim|ayim|im)?\b/u,
  /\ba\s*n\s*a\s*n\s*i\b/u,
  /\ba\s*n\s*a\s*s\s*i\s*n\s*i\b/u,
  /\bo\s*r\s*o\s*s\s*p\s*u\b/u,
  /\bo\s*r\s*o\s*s\s*p\s*u\s+c\s*o\s*c\s*u(?:g|k)?u?\b/u,
  /\bs\s*i\s*k\s*t\s*i\s*r\b/u,
  /\bs\s*i\s*k\s*e(?:yim|rim|cem|cegim)?\b/u,
  /\bs\s*i\s*k\s*i\s*k\b/u,
  /\by\s*a\s*r\s*r?\s*a\s*k\b/u,
  /\bg\s*o\s*t\s*v\s*e\s*r\s*e\s*n\b/u,
  /\bg\s*o\s*t\s*l\s*e\s*k\b/u,
  /\bp\s*i\s*c\b/u,
  /\bp\s*e\s*z\s*e\s*v\s*e\s*n\s*k\b/u,
  /\bs\s*e\s*r\s*e\s*f\s*s\s*i\s*z\b/u,
  /\bh\s*a\s*y\s*s\s*i\s*y\s*e\s*t\s*s\s*i\s*z\b/u,

  // English phrase variants
  /\bf\s*u\s*c\s*k(?:er|ing)?\b/u,
  /\bm\s*o\s*t\s*h\s*e\s*r\s*f\s*u\s*c\s*k\s*e\s*r\b/u,
  /\ba\s*s\s*h\s*o\s*l\s*e\b/u,
  /\bb\s*i\s*t\s*c\s*h\b/u,
  /\bc\s*u\s*n\s*t\b/u
] as const;

const SEXUAL_CONTENT_TERMS = [
  // Turkish
  "ciplak",
  "cinsel",
  "seks",
  "porno",
  "pornografi",
  "erotik",
  "escort",
  "masturbasyon",
  "masturbe",
  "sikis",
  "sevisme",

  // English
  "sex",
  "sexual",
  "porn",
  "porno",
  "nude",
  "naked",
  "erotic",
  "escort",
  "sexting",
  "masturbation",
  "masturbate",
  "onlyfans"
] as const;

const SEXUAL_CONTENT_PATTERNS = [
  /\bc\s*i\s*n\s*s\s*e\s*l\b/u,
  /\bs\s*e\s*k\s*s\b/u,
  /\bp\s*o\s*r\s*n\s*o?\b/u,
  /\bc\s*i\s*p\s*l\s*a\s*k\b/u,
  /\be\s*r\s*o\s*t\s*i\s*k\b/u,
  /\be\s*s\s*c\s*o\s*r\s*t\b/u,
  /\bm\s*a\s*s\s*t\s*u\s*r\s*b(?:asyon|e|ation|ate)?\b/u,
  /\bo\s*n\s*l\s*y\s*f\s*a\s*n\s*s\b/u,
  /\bn\s*u\s*d\s*e\b/u,
  /\bn\s*a\s*k\s*e\s*d\b/u,
  /\bs\s*e\s*x(?:ual|ting)?\b/u
] as const;

const THREAT_PATTERNS = [
  // English direct threats
  /\b(?:i will|i'?ll|im going to|i am going to|gonna)\s+(?:kill|hurt|beat|stab|shoot|burn|destroy)\s+(?:you|u)\b/u,
  /\b(?:kill|hurt|beat|stab|shoot|burn)\s+(?:you|u)\b/u,
  /\bbeat\s+(?:you|u)\s+up\b/u,
  /\bi\s+will\s+find\s+(?:you|u)\b/u,
  /\bi\s+know\s+where\s+(?:you|u)\s+live\b/u,
  /\bi\s+will\s+come\s+to\s+your\s+(?:home|house|address)\b/u,

  // Turkish direct threats
  /\bseni\s+(?:oldururum|oldurecegim|gebertirim|gebertecegim|dovecegim|dovucem|dovucem|dovcem|vururum|vurucam|vuracagim|bicaklarim|bicaklayacagim|yakarim|yakacagim|mahvederim)\b/u,
  /\b(?:oldururum|oldurecegim|gebertirim|gebertecegim|dovecegim|dovucem|dovcem|vururum|vurucam|vuracagim|bicaklarim|bicaklayacagim|yakarim|yakacagim)\b/u,
  /\bkafana\s+sikarim\b/u,
  /\bseni\s+bulurum\b/u,
  /\badresini\s+bulurum\b/u,
  /\bevine\s+gelirim\b/u,
  /\bevini\s+basarim\b/u,
  /\bgelip\s+seni\s+(?:dovecegim|dovucem|dovcem|oldurecegim|gebertirim|vururum)\b/u,
  /\b(?:agzini|burnunu)\s+kirarim\b/u,
  /\bkemiklerini\s+kirarim\b/u,
  /\bcanina\s+okurum\b/u
] as const;