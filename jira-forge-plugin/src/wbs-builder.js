// wbs-builder.js

/**
 * Build WBS based on deterministic effort rules.
 *
 * BaseTotalEffort represents:
 *   Development + Unit Testing ONLY
 */
 
// wbs-builder.js

const E2E_TEST_PERCENTAGE = {
  "None": 0,
  "Very Simple": 0.1,
  "Simple": 0.2,
  "Medium": 0.3,
  "Complex": 0.4,
  "Very Complex": 0.5
};


const SFD_PERCENTAGE = {
  "None": 0,
  "Very Simple": 0.1,
  "Simple": 0.2,
  "Medium": 0.3,
  "Complex": 0.4,
  "Very Complex": 0.5
};

// const RW_PERCENTAGE = {
  // "None": 0,
  // "Very Simple": 0.05,
  // "Simple": 0.1,
  // "Medium": 0.15,
  // "Complex": 0.2,
  // "Very Complex": 0.25
// };

export function buildWbs(baseTotalEffort, complexity) {

  // ✅ Overheads (based on Base Total Effort)
  const unitTesting = baseTotalEffort * 0.20;
  const codeReview = baseTotalEffort * 0.10;
  const documentation = baseTotalEffort * 0.05;
  const codeManagement = baseTotalEffort * 0.05;

  // ✅ Development is DERIVED
  const development =
    baseTotalEffort
    - unitTesting
    - codeReview
    - documentation
    - codeManagement;

  // ✅ NEW: End-to-End Testing (based on DEV only)
  const e2ePercentage = E2E_TEST_PERCENTAGE[complexity] ?? 0;
  const endToEndTesting = development * e2ePercentage;

  // ✅ NEW: End-to-End Testing (based on DEV only)
  const sfdPercentage = SFD_PERCENTAGE[complexity] ?? 0;
  const functionalSpecification = development * sfdPercentage;
  
  // ✅ NEW: End-to-End Testing (based on DEV only)
  // const rwPercentage = RW_PERCENTAGE[complexity] ?? 0;
  // const rework = development * rwPercentage;
  
  // ✅ Final Effort (enterprise definition)
  const finalEffort =
    baseTotalEffort +
    endToEndTesting +
	functionalSpecification;
	// rework;

  return {
    wbs: {
      "Development": development,
      "Unit Testing": unitTesting,
      "Code Review": codeReview,
      "Documentation": documentation,
      "Code Management": codeManagement,	  
      "End-to-End Testing": endToEndTesting,
	  "Functional Specification": functionalSpecification
	  // "Rework": rework,
    },
    finalEffort
  };
}
