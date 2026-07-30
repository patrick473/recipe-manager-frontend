const INGREDIENTS_HEADING = /^#{1,6}\s+.*ingredients.*$/i;
const ANY_HEADING = /^#{1,6}\s+/;
const BULLET_LINE = /^([-*]\s+)(.*)$/;

const LEADING_QUANTITY = /^(\d+\s+\d+\/\d+|\d+\/\d+|\d+\.\d+|\d+)(?=[a-zA-Z\s]|$)/;

/** Nearest-eighth table used to round scaled fraction-style quantities. */
const EIGHTHS: { value: number; label: string }[] = [
  { value: 0, label: '0' },
  { value: 1 / 8, label: '1/8' },
  { value: 1 / 4, label: '1/4' },
  { value: 3 / 8, label: '3/8' },
  { value: 1 / 2, label: '1/2' },
  { value: 5 / 8, label: '5/8' },
  { value: 3 / 4, label: '3/4' },
  { value: 7 / 8, label: '7/8' },
];

/**
 * Parses a leading quantity token (integer, decimal, simple fraction, or
 * mixed number) into a number. Returns null for anything else (e.g. "salt").
 */
export function parseQuantityToken(token: string): number | null {
  if (/^\d+\s+\d+\/\d+$/.test(token)) {
    const [whole, fraction] = token.split(/\s+/);
    const [num, den] = fraction.split('/').map(Number);
    return Number(whole) + num / den;
  }
  if (/^\d+\/\d+$/.test(token)) {
    const [num, den] = token.split('/').map(Number);
    return num / den;
  }
  if (/^\d+(\.\d+)?$/.test(token)) {
    return Number(token);
  }
  return null;
}

/**
 * Formats a scaled numeric quantity back to text, matching the convention
 * the original token used: fraction-style values round to the nearest
 * eighth and render as a plain-ASCII mixed number, decimal-style values
 * round to at most 2 places with trailing zeros trimmed. A result of 0 is
 * clamped to the smallest representable unit rather than emitted as "0".
 */
export function formatScaledQuantity(value: number, wasFraction: boolean): string {
  if (wasFraction) {
    const whole = Math.floor(value);
    const remainder = value - whole;
    const nearest = EIGHTHS.reduce((best, candidate) =>
      Math.abs(candidate.value - remainder) < Math.abs(best.value - remainder) ? candidate : best,
    );

    if (whole === 0 && nearest.value === 0) {
      return EIGHTHS[1].label;
    }
    if (nearest.value === 0) {
      return String(whole);
    }
    return whole > 0 ? `${whole} ${nearest.label}` : nearest.label;
  }

  const rounded = Math.round(value * 100) / 100;
  if (rounded === 0) {
    return '0.01';
  }
  return String(rounded);
}

/**
 * Scales the leading quantity on every bulleted ingredient line inside the
 * `## Ingredients` section of a recipe's Markdown content. Lines outside
 * that section (including numbered `## Instructions` steps) and bulleted
 * lines with no leading quantity (e.g. "salt to taste") are left untouched.
 */
export function scaleIngredientsMarkdown(content: string, factor: number): string {
  const lines = content.split('\n');
  let inIngredientsSection = false;

  const scaledLines = lines.map((line) => {
    if (ANY_HEADING.test(line)) {
      inIngredientsSection = INGREDIENTS_HEADING.test(line);
      return line;
    }
    if (!inIngredientsSection) {
      return line;
    }

    const bulletMatch = line.match(BULLET_LINE);
    if (!bulletMatch) {
      return line;
    }

    const [, marker, rest] = bulletMatch;
    const quantityMatch = rest.match(LEADING_QUANTITY);
    if (!quantityMatch) {
      return line;
    }

    const token = quantityMatch[0];
    const parsed = parseQuantityToken(token);
    if (parsed === null) {
      return line;
    }

    const scaled = formatScaledQuantity(parsed * factor, token.includes('/'));
    return `${marker}${scaled}${rest.slice(token.length)}`;
  });

  return scaledLines.join('\n');
}

/** Whether `content` has at least one ingredient line that scaling would affect. */
export function hasScalableIngredients(content: string): boolean {
  const lines = content.split('\n');
  let inIngredientsSection = false;

  return lines.some((line) => {
    if (ANY_HEADING.test(line)) {
      inIngredientsSection = INGREDIENTS_HEADING.test(line);
      return false;
    }
    if (!inIngredientsSection) {
      return false;
    }

    const bulletMatch = line.match(BULLET_LINE);
    if (!bulletMatch) {
      return false;
    }

    return LEADING_QUANTITY.test(bulletMatch[2]);
  });
}
