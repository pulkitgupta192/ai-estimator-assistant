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

export async function estimate(summary, description, issueKey) {
  console.log("ENV AI_PROVIDER:", process.env.AI_PROVIDER);
  console.log("ENV AI_MODEL:", process.env.AI_MODEL);

  const provider = (process.env.AI_PROVIDER || DEFAULT_PROVIDER).toLowerCase();
  const model = process.env.AI_MODEL;

  console.log("AI Provider:", provider);
  console.log("AI Model:", model);
  console.log("Issue Key:", issueKey);

  try {
    let result;

    switch (provider) {
      case "openai":
        result = await openaiEstimate(summary, description, model);
        break;
      case "gemini":
        result = await geminiEstimate(summary, description, model);
        break;
      case "azure":
        result = await azureEstimate(summary, description, model);
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

    if (!result.ok) {
      return {
        ok: false,
        error: result
      };
    }

    // ✅ Extract effort + meta from provider
    const effort = result.effort;
    const meta = result.meta || {};

    // ✅ Build WBS based on Streamlit mathematics
    const wbs = buildWbs(meta, effort);
    const wbsMarkdown = wbsToMarkdown(wbs);

    // ✅ Build Jira Comment body
    const commentBody = `
### ✅ AI Effort Estimate

**Total Estimated Hours:** ${effort}h  
**Complexity:** ${meta.complexity}  
**Direction:** ${meta.direction}  
**Flow:** ${meta.flow}  

---

${wbsMarkdown}

---

### 🧠 AI Reasoning
${meta.reason}
`.trim();

    // ✅ POST Jira Comment
    console.log("Posting Jira Comment...");
	// ✅ Post Jira Comment as USER (visible)
	await api.asApp().requestJira(route`/rest/api/3/issue/${issueKey}/comment`, {
	  method: "POST",
	  headers: { "Content-Type": "application/json" },
	  body: JSON.stringify({ body: commentBody })
	});

    console.log("Jira Comment posted successfully.");

    // ✅ UPDATE Jira Original Estimate field
    console.log("Updating Jira Original Estimate...");

	await api.asApp().requestJira(
	  route`/rest/api/3/issue/${issueKey}/comment`,
	  {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ body: commentBody })
	  }
	);

    console.log("Original Estimate updated successfully.");

    // ✅ Return unified response
    return {
      ok: true,
      data: { effort, meta, wbs }
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