// wbs-builder.js

/**
 * Build WBS breakdown based on meta and effort.
 * Structure mirrors your Streamlit calculations.
 */
export function buildWbs(meta, effortHours) {
  const complexity = meta?.complexity || "Medium";
  const flow = meta?.flow || "Uni-Directional";

  // Base weights as used in Streamlit
  const WEIGHTS = {
    "Very Simple": 0.2,
    "Simple": 0.5,
    "Medium": 0.75,
    "Complex": 1.0,
    "Very Complex": 2.0
  };

  const weight = WEIGHTS[complexity] ?? 0.75;
  const BASE_DESIGN_DAYS = 3.1625;

  const techDesignDays = BASE_DESIGN_DAYS * weight;
  const techDesignHours = techDesignDays * 8;

  // Split remaining hours across WBS exactly as your app
  const remaining = effortHours - techDesignHours;

  const coreDev = remaining * 0.70;
  const review = coreDev * 0.05;
  const unitTest = coreDev * 0.10;
  const docs = coreDev * 0.10;
  const mgmt = coreDev * 0.05;

  const wbs = {
    "Tech Design": techDesignHours,
    "Core Development": coreDev,
    "Code Review (5%)": review,
    "Unit Testing (10%)": unitTest,
    "Documentation (10%)": docs,
    "Code Management (5%)": mgmt
  };

  return wbs;
}

/**
 * Convert the WBS structure into Jira-friendly markdown
 */
export function wbsToMarkdown(wbs) {
  let md = `### Work Breakdown Structure (WBS)\n\n`;
  md += `| Activity | Hours |\n`;
  md += `|---------|--------|\n`;

  for (const [key, value] of Object.entries(wbs)) {
    md += `| ${key} | ${value.toFixed(2)} |\n`;
  }

  return md;
}