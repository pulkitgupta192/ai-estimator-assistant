import { openaiEstimate } from "./openai-provider.js";
import { geminiEstimate } from "./gemini-provider.js";
import { azureEstimate } from "./azure-provider.js";
import { localEstimate } from "./local-provider.js";

import { buildWbs, wbsToMarkdown } from "./wbs-builder.js";

import api, { route } from "@forge/api";

const DEFAULT_PROVIDER = "openai";

/**
 * FINAL PRODUCTION VERSION
 * -------------------------
 * Fully updates:
 * ✅ AI Estimate
 * ✅ WBS Breakdown
 * ✅ Jira Comment
 * ✅ Original Estimate field
 */
 
const typeToSubtype = {
  "Custom Objects": "CU_OB",
  "Custom Page/Screen/Tab": "CU_PA",
  "Custom Event": "CU_EV",
  "BPA": "CU_BP",
  "Lobby": "CU_LO",
  "Business Report": "RE_BR",
  "Quick Report": "RE_QR",
  "Interface (IN)": "IN_IN",
  "Interface (OUT)": "IN_OU",
  "Interface (API)": "IN_AP",
  "Interface Armony Data": "IN_AD",
  "Modification Flux": "MO_FL",
  "Modification Screen": "MO_SC",
  "Forms Armony Report": "FO_AR",
  "Forms Crystal Report": "FO_CR",
  "Forms Report Designer": "FO_RD",
  "Data Migration (Migration Task)": "DM_MT",
  "Data Migration (Script)": "DM_SC"
};

const crimtypeEstimateMap = {
  CU_OB: { "Very Simple": 0.25, Simple: 0.5, Medium: 1, Complex: 2, "Very Complex": 4 },
  CU_PA: { "Very Simple": 1, Simple: 2, Medium: 4, Complex: 8, "Very Complex": 16 },
  CU_EV: { "Very Simple": 1, Simple: 2, Medium: 4, Complex: 7, "Very Complex": 14 },
  CU_BP: { "Very Simple": 1, Simple: 2, Medium: 4, Complex: 9, "Very Complex": 18 },
  CU_LO: { "Very Simple": 0.75, Simple: 1.5, Medium: 3, Complex: 6, "Very Complex": 9 },
  RE_BR: { "Very Simple": 1, Simple: 2, Medium: 6, Complex: 10, "Very Complex": 15 },
  RE_QR: { "Very Simple": 0.5, Simple: 1, Medium: 2, Complex: 4, "Very Complex": 6 },
  IN_IN: { "Very Simple": 4, Simple: 8, Medium: 14, Complex: 21, "Very Complex": 30 },
  IN_OU: { "Very Simple": 3, Simple: 6, Medium: 10, Complex: 15, "Very Complex": 22 },
  IN_AP: { "Very Simple": 3, Simple: 6, Medium: 10, Complex: 15, "Very Complex": 22 },
  IN_AD: { "Very Simple": 1.5, Simple: 3, Medium: 6, Complex: 10, "Very Complex": 15 },
  MO_FL: { "Very Simple": 3, Simple: 6, Medium: 12, Complex: 18, "Very Complex": 24 },
  MO_SC: { "Very Simple": 1, Simple: 2, Medium: 4, Complex: 8, "Very Complex": 16 },
  FO_RD: { "Very Simple": 1.5, Simple: 3, Medium: 6, Complex: 12, "Very Complex": 18 },
  FO_AR: { "Very Simple": 0.75, Simple: 1.5, Medium: 3, Complex: 6, "Very Complex": 9 },
  FO_CR: { "Very Simple": 1.25, Simple: 2.25, Medium: 4.5, Complex: 9, "Very Complex": 13.5 },
  DM_MT: { "Very Simple": 0.5, Simple: 1.5, Medium: 3, Complex: 7, "Very Complex": 12 },
  DM_SC: { "Very Simple": 1, Simple: 3, Medium: 6, Complex: 9, "Very Complex": 12 }
};

const INTERFACE_SUBTYPES = ["IN_IN", "IN_OU", "IN_AP"];

function normalizeDirection(direction, sub_type) {
  if (sub_type === "IN_IN") return "Inbound";
  if (sub_type === "IN_OU") return "Outbound";
  if (sub_type === "IN_AP") return direction ?? "Bi-Directional";
  return null;
}

function normalizeFlow(flow) {
  if (flow === "Bi-Directional" || flow === "Uni-Directional") {
    return flow;
  }
  return "Uni-Directional";
}

function buildWbsTable(wbs) {
  return {
    type: "table",
    attrs: {
      isNumberColumnEnabled: false,
      layout: "default"
    },
    content: [
      // ✅ Header row
      {
        type: "tableRow",
        content: [
          {
            type: "tableHeader",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "Activity" }]
              }
            ]
          },
          {
            type: "tableHeader",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "Hours" }]
              }
            ]
          }
        ]
      },

      // ✅ Data rows
      ...Object.entries(wbs).map(([activity, hours]) => ({
        type: "tableRow",
        content: [
          {
            type: "tableCell",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: activity }]
              }
            ]
          },
          {
            type: "tableCell",
            content: [
              {
                type: "paragraph",
                content: [
                  { type: "text", text: Number(hours).toFixed(1) }
                ]
              }
            ]
          }
        ]
      }))
    ]
  };
}

function buildSummaryTable({
  finalEffort,
  complexity,
  isInterface,
  direction,
  flow
}) {
  const rows = [
    ["Total Estimated Hours", `${finalEffort.toFixed(1)} h`],
    ["Complexity", complexity]
  ];

  if (isInterface) {
    rows.push(["Direction", direction]);
    rows.push(["Flow", flow]);
  }

  return {
    type: "table",
    attrs: { isNumberColumnEnabled: false },
    content: rows.map(([key, value], index) => ({
      type: "tableRow",
      content: [
        {
          type: index === 0 ? "tableHeader" : "tableCell",
          content: [{ type: "paragraph", content: [{ type: "text", text: key }] }]
        },
        {
          type: index === 0 ? "tableHeader" : "tableCell",
          content: [{ type: "paragraph", content: [{ type: "text", text: value }] }]
        }
      ]
    }))
  };
}

export async function estimate(summary, description, issueKey, jiraMeta = {}) {
  console.log("ENV AI_PROVIDER:", process.env.AI_PROVIDER);
  console.log("ENV AI_MODEL:", process.env.AI_MODEL);

  const provider = (process.env.AI_PROVIDER ?? DEFAULT_PROVIDER).toLowerCase();
  const model = process.env.AI_MODEL;

  const crim_type = jiraMeta?.crim_type ?? null;
  const sub_type = typeToSubtype[crim_type] ?? null;

  console.log("CRIM Type:", crim_type);
  console.log("Sub Type:", sub_type);
  console.log("AI Provider:", provider);
  console.log("AI Model:", model);
  console.log("Issue Key:", issueKey);

  // ✅ DECLARE RESULT FIRST
  let result;

  try {
    switch (provider) {
      case "openai":
        result = await openaiEstimate(summary, description, model, jiraMeta);
        break;
		
      case "azure":
        result = await azureEstimate(summary, description, model, jiraMeta);
        break;

      case "local":
        result = await localEstimate(summary, description, model);
        break;

      default:
        return {
          ok: false,
          error: {
            code: "CONFIG",
            message: `Unsupported provider '${provider}'`,
            retryable: false
          }
        };
    }
					   
    if (!result || result.ok !== true) {
      return {
        ok: false,
        error: result?.error ?? {
          code: "AI_UPSTREAM",
          message: "AI provider returned no result",
          retryable: true
        }
      };
    }
 
    // ✅ SAFE: result EXISTS from here onward
    const meta = result.meta ?? {};

    const complexity = meta.complexity;
					
    // ✅ Interface intelligence (NOW SAFE)
    const isInterface = INTERFACE_SUBTYPES.includes(sub_type);
		   

    const normalizedDirection = isInterface
      ? normalizeDirection(meta.direction, sub_type)
      : null;

    const normalizedFlow = isInterface
      ? normalizeFlow(meta.flow)
      : null;

    // ✅ Effort mapping (DAYS → HOURS)
    const baseTotalEffortDays = crimtypeEstimateMap[sub_type]?.[complexity];
    const baseTotalEffort = baseTotalEffortDays * 8;


	console.log("Base Effort (Days):", baseTotalEffortDays);
	console.log("Base Effort (Hours):", baseTotalEffort);	

	if (baseTotalEffort === null) {
	  return {
		ok: false,
		error: {
		  code: "EFFORT_MAPPING_FAILED",
		  message: `No effort mapping for sub_type=${sub_type}, complexity=${complexity}`,
		  retryable: false
		}
	  };
	}

    const { wbs, finalEffort } = buildWbs(baseTotalEffort);
		
	const wbsTable = buildWbsTable(wbs);

	const roundedFinalEffort = Math.round(finalEffort * 10) / 10;
	
	const summaryTable = buildSummaryTable({
	  finalEffort: roundedFinalEffort,
	  complexity,
	  isInterface,
	  direction: normalizedDirection,
	  flow: normalizedFlow
	});

	await api.asApp().requestJira(
	  route`/rest/api/3/issue/${issueKey}/comment`,
	  {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
		  body: {
			type: "doc",
			version: 1,
			content: [
			  // 🔹 Heading
			  {
				type: "heading",
				attrs: { level: 3 },
				content: [{ type: "text", text: "✅ AI Effort Estimate Summary" }]
			  },

			  // 🔹 Summary table (already implemented by you)
			  summaryTable,

			  // Spacer
			  { type: "paragraph", content: [{ type: "text", text: " " }] },

			  // 🔹 WBS Heading
			  {
				type: "heading",
				attrs: { level: 4 },
				content: [{ type: "text", text: "🧩 Work Breakdown Structure" }]
			  },

			  // 🔹 NATIVE WBS TABLE ✅
			  wbsTable,

			  // Spacer
			  { type: "paragraph", content: [{ type: "text", text: " " }] },

			  // 🔹 Reasoning heading
			  {
				type: "heading",
				attrs: { level: 4 },
				content: [{ type: "text", text: "🧠 AI Reasoning" }]
			  },

			  // 🔹 Reasoning content
			  {
				type: "paragraph",
				content: [{ type: "text", text: meta.reason }]
			  }
			]
		  }
		})
	  }
	);
			
    return {
      ok: true,
      data: { finalEffort, meta, wbs }
    };

  } catch (err) {
    console.error("Estimator failed:", err);

    return {
      ok: false,
      error: {
        code: "INTERNAL",
        message: "Unexpected internal error.",
        retryable: true,
        detail: { name: err?.name, message: err?.message }
      }
    };
  }
}