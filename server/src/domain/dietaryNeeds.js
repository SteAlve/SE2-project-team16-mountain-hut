import { ValidationError } from './errors.js';

// The preset dietary needs a hiker can choose for a guest (MH-05), as in the mockup
// (docs/mockups/dietary). Anything not in the lists is written in words ("other").
// The lists are still to be confirmed by the PO.
export const DIETS = Object.freeze(['VEGETARIAN', 'VEGAN', 'PESCATARIAN', 'LACTOSE_FREE']);

export const ALLERGIES = Object.freeze(['GLUTEN', 'MILK', 'EGGS', 'PEANUTS', 'TREE_NUTS', 'FISH', 'SHELLFISH']);

// A guest can follow more than one diet (lactose-free and vegan), but only one of these, which
// exclude each other.
const EXCLUSIVE_DIETS = Object.freeze(['VEGETARIAN', 'VEGAN', 'PESCATARIAN']);

// The diets and the allergies of the lines must be the preset ones, and the diets must go together.
// A wrong one is bad input (400).
export const checkDietaryNeeds = (requirements) => {
  for (const { diets, allergies } of requirements) {
    if (diets.some((diet) => !DIETS.includes(diet))) {
      throw new ValidationError(`diets can contain only ${DIETS.join(', ')}`);
    }
    if (diets.filter((diet) => EXCLUSIVE_DIETS.includes(diet)).length > 1) {
      throw new ValidationError(`A guest can follow only one of ${EXCLUSIVE_DIETS.join(', ')}`);
    }
    if (allergies.some((allergy) => !ALLERGIES.includes(allergy))) {
      throw new ValidationError(`allergies can contain only ${ALLERGIES.join(', ')}`);
    }
  }
};
