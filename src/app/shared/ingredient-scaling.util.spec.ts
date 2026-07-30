import {
  formatScaledQuantity,
  hasScalableIngredients,
  parseQuantityToken,
  scaleIngredientsMarkdown,
} from './ingredient-scaling.util';

const RECIPE = `## Ingredients

- 1 1/2 cups all-purpose flour
- 400g spaghetti
- 1kg ripe tomatoes
- 3 large eggs
- 1/2 cup crushed San Marzano tomatoes
- salt to taste
- pinch of salt

## Instructions

1. Mix everything together.
2. Cook until done.
`;

describe('parseQuantityToken', () => {
  it('parses a bare integer', () => {
    expect(parseQuantityToken('3')).toBe(3);
  });

  it('parses a decimal', () => {
    expect(parseQuantityToken('1.5')).toBe(1.5);
  });

  it('parses a simple fraction', () => {
    expect(parseQuantityToken('1/2')).toBe(0.5);
  });

  it('parses a mixed number', () => {
    expect(parseQuantityToken('1 1/2')).toBe(1.5);
  });

  it('returns null for a number glued to a unit', () => {
    expect(parseQuantityToken('400g')).toBeNull();
  });

  it('returns null for non-numeric text', () => {
    expect(parseQuantityToken('salt')).toBeNull();
  });
});

describe('formatScaledQuantity', () => {
  it('renders a fraction-style value as a plain mixed number, rounded to the nearest eighth', () => {
    expect(formatScaledQuantity(2.6, true)).toBe('2 5/8');
  });

  it('renders a whole fraction-style value with no fraction part', () => {
    expect(formatScaledQuantity(3, true)).toBe('3');
  });

  it('renders a fraction-style value under 1 with no leading whole number', () => {
    expect(formatScaledQuantity(0.5, true)).toBe('1/2');
  });

  it('clamps a fraction-style value that rounds to zero to the smallest eighth', () => {
    expect(formatScaledQuantity(0.01, true)).toBe('1/8');
  });

  it('renders a decimal-style value rounded to 2 places with trailing zeros trimmed', () => {
    expect(formatScaledQuantity(3.5, false)).toBe('3.5');
    expect(formatScaledQuantity(600, false)).toBe('600');
  });

  it('clamps a decimal-style value that rounds to zero', () => {
    expect(formatScaledQuantity(0.001, false)).toBe('0.01');
  });
});

describe('scaleIngredientsMarkdown', () => {
  it('scales every quantity line inside the Ingredients section', () => {
    const scaled = scaleIngredientsMarkdown(RECIPE, 2);

    expect(scaled).toContain('- 3 cups all-purpose flour');
    expect(scaled).toContain('- 800g spaghetti');
    expect(scaled).toContain('- 2kg ripe tomatoes');
    expect(scaled).toContain('- 6 large eggs');
    expect(scaled).toContain('- 1 cup crushed San Marzano tomatoes');
  });

  it('leaves non-quantity ingredient lines unchanged', () => {
    const scaled = scaleIngredientsMarkdown(RECIPE, 2);

    expect(scaled).toContain('- salt to taste');
    expect(scaled).toContain('- pinch of salt');
  });

  it('never touches numbered Instructions steps, even though they also start with digits', () => {
    const scaled = scaleIngredientsMarkdown(RECIPE, 2);

    expect(scaled).toContain('1. Mix everything together.');
    expect(scaled).toContain('2. Cook until done.');
  });

  it('returns content unchanged when there is no Ingredients heading', () => {
    const noHeading = '- 1 cup flour\n\n1. Mix.\n';
    expect(scaleIngredientsMarkdown(noHeading, 2)).toBe(noHeading);
  });

  it('returns output equal to the input at a factor of 1, modulo eighth-rounding normalization', () => {
    const scaled = scaleIngredientsMarkdown(RECIPE, 1);

    expect(scaled).toContain('- 1 1/2 cups all-purpose flour');
    expect(scaled).toContain('- 400g spaghetti');
    expect(scaled).toContain('- 3 large eggs');
  });
});

describe('hasScalableIngredients', () => {
  it('returns true for a recipe with at least one leading quantity', () => {
    expect(hasScalableIngredients(RECIPE)).toBe(true);
  });

  it('returns false when there is no Ingredients heading', () => {
    expect(hasScalableIngredients('- 1 cup flour\n\n1. Mix.\n')).toBe(false);
  });

  it('returns false when the Ingredients section is entirely non-numeric lines', () => {
    const content = '## Ingredients\n\n- salt to taste\n- pinch of pepper\n';
    expect(hasScalableIngredients(content)).toBe(false);
  });
});
