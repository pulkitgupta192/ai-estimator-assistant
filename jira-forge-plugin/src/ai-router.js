import { openaiEstimate } from "./openai-provider.js";
import { geminiEstimate } from "./gemini-provider.js";
import { localEstimate } from "./local-provider.js";
import { azureEstimate } from "./azure-provider.js";

// Optional: central config
const DEFAULT_PROVIDER = "openai";

export async function estimate(summary, description) {
  console.log("ENV AI_PROVIDER:", process.env.AI_PROVIDER);
  console.log("ENV AI_MODEL:", process.env.AI_MODEL);

  const provider = (process.env.AI_PROVIDER || DEFAULT_PROVIDER).toLowerCase();
  const model = process.env.AI_MODEL;

  console.log("AI Provider:", provider);
  console.log("AI Model:", model);

  try {
    let result;

    if (provider === "openai") {
		result = await openaiEstimate(summary, description, model);
	} else if (provider === "gemini") {
		result = await geminiEstimate(summary, description, model);
	} else if (provider === "local") {
		result = await localEstimate(summary, description, model);
	} else if (provider === "azure") {
		result = await azureEstimate(summary, description, model);
	} else {
		return {
		  ok: false,
		  error: {
			code: "CONFIG",
			message: `Unsupported AI_PROVIDER '${provider}'. Expected openai|gemini|local|azure.`,
			retryable: false
		  }
		};
	}

    // If provider already returns Result envelope, pass through
    if (result && typeof result === "object" && "ok" in result) {
      return result;
    }

    // Backward-compat: provider returned string/number
    const effort = normalizeEffort(result);
    if (effort == null) {
      return {
        ok: false,
        error: {
          code: "AI_PARSE",
          message: "Estimator did not return a valid numeric effort.",
          retryable: true,
          detail: { raw: result }
        }
      };
    }

    return { ok: true, data: { effort } };
  } catch (e) {
    console.error("Estimator failed:", e);
    return {
      ok: false,
      error: {
        code: "INTERNAL",
        message: "Unexpected error while estimating effort.",
        retryable: true,
        detail: { name: e?.name, message: e?.message }
      }
    };
  }
}

function normalizeEffort(raw) {
  if (raw == null) return null;

  // If provider returned number directly
  if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) return raw;

  // If provider returned numeric string
  if (typeof raw === "string") {
    const m = raw.trim().match(/-?\d+(\.\d+)?/);
    if (!m) return null;
    const n = Number(m[0]);
    if (!Number.isFinite(n) || n < 0) return null;
    return n;
  }

  return null;
}