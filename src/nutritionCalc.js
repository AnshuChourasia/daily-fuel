// Pure helpers for the two measurement methods. No React, no dependencies.

export const METHOD_PER_SERVING = 'perServing';
export const METHOD_PER_100G = 'per100g';

// Older saved foods have no `method` field; treat them as per-serving.
export function normalizeFood(food) {
  return {
    ...food,
    method: food.method === METHOD_PER_100G ? METHOD_PER_100G : METHOD_PER_SERVING,
    servingName: food.servingName || 'serving',
    servingWeightG: food.servingWeightG ?? null,
  };
}

// Returns per-serving protein/calories for a food, whichever method it uses.
export function getPerServing(food) {
  const f = normalizeFood(food);
  if (f.method === METHOD_PER_100G) {
    const w = Number(f.servingWeightG);
    return {
      protein: (Number(f.proteinPer100g) * w) / 100,
      calories: (Number(f.caloriesPer100g) * w) / 100,
    };
  }
  return {
    protein: Number(f.proteinPerServing),
    calories: Number(f.caloriesPerServing),
  };
}

// Totals for a logged quantity of a food.
export function calculateEntry(food, quantity) {
  const per = getPerServing(food);
  return {
    protein: per.protein * quantity,
    calories: per.calories * quantity,
  };
}

// Validation: returns an error message string, or null if valid.
export function validateFood(input) {
  const isNonNeg = (v) => v !== '' && v !== null && Number.isFinite(Number(v)) && Number(v) >= 0;
  if (!input.name || !input.name.trim()) return 'Food name is required.';
  if (!input.servingName || !input.servingName.trim()) return 'Serving name is required.';
  if (input.method === METHOD_PER_100G) {
    const w = Number(input.servingWeightG);
    if (input.servingWeightG === '' || !Number.isFinite(w) || w <= 0) {
      return 'Weight per serving must be greater than 0 g.';
    }
    if (!isNonNeg(input.proteinPer100g)) return 'Protein per 100 g must be 0 or more.';
    if (!isNonNeg(input.caloriesPer100g)) return 'Calories per 100 g must be 0 or more.';
  } else {
    if (!isNonNeg(input.proteinPerServing)) return 'Protein per serving must be 0 or more.';
    if (!isNonNeg(input.caloriesPerServing)) return 'Calories per serving must be 0 or more.';
  }
  return null;
}

// Labels that change with the selected method.
export function getLabels(method) {
  return method === METHOD_PER_100G
    ? { protein: 'Protein per 100 g (g)', calories: 'Calories per 100 g (kcal)' }
    : { protein: 'Protein per serving (g)', calories: 'Calories per serving (kcal)' };
}

// "3 chunks", "1 piece", "2 bowls"
export function formatServingCount(quantity, servingName) {
  const q = Number(quantity);
  if (q === 1) return `1 ${servingName}`;
  const plural = servingName.endsWith('s') ? servingName : `${servingName}s`;
  return `${q} ${plural}`;
}
