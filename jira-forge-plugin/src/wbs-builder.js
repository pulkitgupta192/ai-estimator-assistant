// wbs-builder.js

/**
 * Build WBS based on deterministic effort rules.
 *
 * BaseTotalEffort represents:
 *   Development + Unit Testing ONLY
 */
export function buildWbs(baseTotalEffort) {
  // ✅ Core calculation
  const unitTesting = baseTotalEffort * 0.20;
  const development = baseTotalEffort - unitTesting;

  // ✅ Overheads (based on BaseTotalEffort)
  const codeReview = baseTotalEffort * 0.10;
  const documentation = baseTotalEffort * 0.05;
  const codeManagement = baseTotalEffort * 0.05;

  // ✅ Final Effort (what goes to Jira Original Estimate)
  const finalEffort =
    baseTotalEffort +
    codeReview +
    documentation +
    codeManagement;

  const roundedFinalEffort = Number(finalEffort.toFixed(1));

  return {
    wbs: {
      "Development": development,
      "Unit Testing": unitTesting,
      "Code Review": codeReview,
      "Documentation": documentation,
      "Code Management": codeManagement
    },
    finalEffort,
	roundedFinalEffort
  };
}
