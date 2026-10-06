const ACTIONS = {
  DEFINITION: 'Read it, close the notes, and explain it in your own words.',
  DERIVATION: 'Hide the derivation and reproduce the steps from memory.',
  EXAMPLE: 'Attempt the example before looking at the solution.',
  PROBLEM: 'Attempt the first step before checking the solution.',
  FORMULA: 'Write the formula from memory and explain each variable.',
  THEORY: 'Close the notes and write down three key ideas.',
};

export function getLocalNextAction(step) {
  return ACTIONS[step?.type] || ACTIONS.THEORY;
}

export function getActionTemplate(type) {
  return ACTIONS[type] || ACTIONS.THEORY;
}

export { ACTIONS };
