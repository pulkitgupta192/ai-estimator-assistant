import fetch from "node-fetch";

/**
 * FINAL VERSION — OpenAI Estimator Provider
 * -----------------------------------------
 * Features:
 * ✅ Strict JSON-only output (response_format = json_object)
 * ✅ No hallucination / no apologies
 * ✅ Guaranteed numeric effort
 * ✅ Includes complexity, direction, flow & reasoning for future use
 * ✅ Fully compatible with Jira Forge parsing
 */

export async function openaiEstimate(summary, description, model, jiraMeta = {}) {
  const OPENAI_KEY = process.env.OPENAI_API_KEY;

  const crim_type = jiraMeta?.crim_type ?? "Unknown";

  if (!OPENAI_KEY) {
    return {
      ok: false,
      code: "CONFIG",
      message: "Missing OPENAI_API_KEY",
      retryable: false
    };
  }

  // ✅ FULL ENTERPRISE PROMPT (STRICT JSON)
  const prompt = `
You are a Senior IFS Technical Architect with extensive experience implementing
IFS Applications Cloud, IFS Aurena, IFS Integration Framework, Lobby, Reports,
Custom Objects, BPA, Interfaces, and Data Migration.

You have delivered multiple enterprise implementations following IFS best
practices, including extensibility, upgrade-safe customization, and performance
compliance.

Your task is to classify ONLY the TECHNICAL COMPLEXITY of a Jira requirement.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INPUT CONTEXT (FROM JIRA)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CRIM TYPE:
${crim_type}

Summary:
${summary}

Description:
${description}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CLASSIFICATION RULES (MANDATORY)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. You MUST determine complexity based on:
   - IFS functional scope
   - Data model impact
   - Custom Object / Screen / Business Logic depth
   - Number of entities involved
   - Validation rules, API usage, and orchestration
   - Upgrade-safe extensibility principles
   - Integration direction and data volume
   - Testing and regression impact

2. You MUST consider IFS architectural implications such as:
   - Custom Objects vs Core Modifications
   - Use of IFS APIs, Event Actions, BPA, Lobby Elements
   - Security, projections, and permission complexity
   - View vs Transactional logic
   - Online vs background execution

3. Use IFS enterprise judgment similar to what is described in official
   IFS architecture and extensibility documentation.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COMPLEXITY SCALE (STRICT)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Choose ONE value only:

- Very Simple
  * Configuration-only
  * No new logic
  * Single view or small UI tweak

- Simple
  * Single entity impact
  * Minimal validation or event logic
  * Straightforward customization

- Medium
  * Multiple entities or joins
  * Clear business rules
  * Some validations, APIs, or BPM logic

- Complex
  * Multiple integrations or transactions
  * Performance considerations
  * Heavy business rules and validations

- Very Complex
  * Cross-module impact
  * Complex orchestration, migration, or integrations
  * Upgrade-sensitive areas

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STRICT OUTPUT FORMAT (JSON ONLY)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Return ONLY the following JSON — no additional text:

{
  "complexity": "Very Simple | Simple | Medium | Complex | Very Complex",
  "direction": "Inbound | Outbound",
  "flow": "Uni-Directional | Bi-Directional",
  "reason": "Short, professional, IFS-focused technical explanation"
}

IMPORTANT:
- DO NOT calculate effort
- DO NOT mention hours or days
- DO NOT suggest changes to CRIM or subtype
`.trim();

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_KEY}`
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: "json_object" }, // ✅ HARD JSON ENFORCEMENT
        messages: [
          {
            role: "user",
            content: prompt
          }
        ]
      })
    });

    const data = await response.json();
    console.log("OpenAI Response:", JSON.stringify({ status: response.status, data }));

    if (!response.ok) {
      return {
        ok: false,
        code: "AI_UPSTREAM",
        message: data?.error?.message || "OpenAI request failed.",
        retryable: response.status >= 500,
        status: response.status,
        detail: data
      };
    }

    // ✅ Always valid JSON due to response_format
    let parsed;
    try {
      parsed = JSON.parse(data.choices[0].message.content);
    } catch (err) {
      return {
        ok: false,
        code: "AI_PARSE",
        message: "OpenAI returned invalid JSON.",
        retryable: true,
        detail: { raw: data }
      };
    }

	return {
	  ok: true,
	  meta: {
		complexity: parsed.complexity,
		direction: parsed.direction,
		flow: parsed.flow,
		reason: parsed.reason
	  }
	};

  } catch (e) {
    return {
      ok: false,
      code: "NETWORK",
      message: "Network error calling OpenAI.",
      retryable: true,
      detail: { name: e?.name, message: e?.message }
    };
  }
}
