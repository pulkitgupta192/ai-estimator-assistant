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

export async function openaiEstimate(summary, description, model) {
  const OPENAI_KEY = process.env.OPENAI_API_KEY;

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
You are an expert Senior IFS Technical Architect specializing in effort estimation.

Your job is to estimate ONLY the development effort (in hours) for a Jira ticket.

STRICT OUTPUT FORMAT:
Return ONLY this JSON object with no additional text:
{
  "effort": <number>,
  "complexity": "<Very Simple | Simple | Medium | Complex | Very Complex>",
  "direction": "<Inbound | Outbound>",
  "flow": "<Uni-Directional | Bi-Directional>",
  "reason": "<short markdown explanation>"
}

RULES:
- Never output anything except valid JSON.
- Never apologise.
- Never ask for more details.
- If unclear, estimate your closest reasonable numeric effort.
- "effort" must be > 0.
- JSON must always be valid.

### COMPLEXITY RUBRIC:
1. Very Simple:
   - Basic configuration, small UI tasks, single-view Quick Reports.
   - No logic, no PL/SQL, minimal joins.

2. Simple:
   - Single table or simple join.
   - Basic Event Actions, formatting changes.

3. Medium:
   - Multi-view joins (2–3), PL/SQL wrapper, custom fields with expressions.
   - Simple bi-directional sync.

4. Complex:
   - 4+ table joins, PL/SQL API package, heavy validation logic.
   - Performance tuning required.

5. Very Complex:
   - New LUs, complex data migrations, deep IFS core logic modifications.

### DIRECTION & FLOW:
Infer based on description.

### INTERNAL EFFORT LOGIC (must be applied):
- Base Design Days = 3.1625
- Weightage:
    Very Simple = 0.2  
    Simple = 0.5  
    Medium = 0.75  
    Complex = 1.0  
    Very Complex = 2.0  
- Convert days → hours (1 day = 8 hours)
- effort = Tech Design Hours + Dev Hours + Review + Docs + Mgmt + Testing

INPUT:
Summary: ${summary}
Description: ${description}
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

    // ✅ Validate "effort"
    if (!parsed.effort || typeof parsed.effort !== "number") {
      return {
        ok: false,
        code: "AI_PARSE",
        message: "'effort' missing or invalid.",
        retryable: true,
        detail: parsed
      };
    }

    return {
      ok: true,
      effort: parsed.effort,
      meta: parsed // includes complexity, direction, flow, reasoning
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
