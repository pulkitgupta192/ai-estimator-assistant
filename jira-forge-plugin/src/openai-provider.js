import fetch from "node-fetch";
// ✅ no abort-controller import

export async function openaiEstimate(summary, description, model) {
  const OPENAI_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_KEY) {
    return { ok: false, code: "CONFIG", message: "Missing OPENAI_API_KEY", retryable: false };
  }

  const prompt = `
Estimate development effort in hours.

Summary:
${summary}

Description:
${description}

Return only a number.
`.trim();

  const controller = new AbortController();
  const timeoutMs = 15000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_KEY}`
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2
      })
    });

    const data = await response.json().catch(() => null);
    console.log("OpenAI Response:", JSON.stringify({ status: response.status, data }));

    if (!response.ok || data?.error) {
      const err = data?.error || {};
      const openAiCode = err.code || err.type || "unknown_error";

      if (openAiCode === "insufficient_quota") {
        return {
          ok: false,
          code: "AI_QUOTA",
          message: "OpenAI quota exceeded. Check billing/limits for the API key’s org.",
          retryable: false,
          status: response.status,
          detail: err
        };
      }

      if (response.status === 429) {
        return {
          ok: false,
          code: "AI_RATE_LIMIT",
          message: "OpenAI rate limit reached. Retry later.",
          retryable: true,
          status: response.status,
          detail: err
        };
      }

      if (response.status === 401 || response.status === 403) {
        return {
          ok: false,
          code: "AI_AUTH",
          message: "OpenAI authentication/authorization failed. Verify API key and org.",
          retryable: false,
          status: response.status,
          detail: err
        };
      }

      return {
        ok: false,
        code: "AI_UPSTREAM",
        message: err.message || "OpenAI request failed.",
        retryable: response.status >= 500 || response.status === 429,
        status: response.status,
        detail: err
      };
    }

    const raw = data?.choices?.[0]?.message?.content?.trim();
    if (!raw) {
      return {
        ok: false,
        code: "AI_EMPTY",
        message: "OpenAI returned an empty completion.",
        retryable: true,
        status: response.status,
        detail: data
      };
    }

    const match = raw.match(/-?\d+(\.\d+)?/);
    if (!match) {
      return {
        ok: false,
        code: "AI_PARSE",
        message: "OpenAI did not return a valid numeric effort.",
        retryable: true,
        status: response.status,
        detail: { raw }
      };
    }

    const effort = Number(match[0]);
    if (!Number.isFinite(effort) || effort < 0) {
      return {
        ok: false,
        code: "AI_PARSE",
        message: "Parsed effort is invalid.",
        retryable: true,
        status: response.status,
        detail: { raw, parsed: effort }
      };
    }

    return { ok: true, effort, raw };
  } catch (e) {
    const isTimeout = e?.name === "AbortError";
    return {
      ok: false,
      code: isTimeout ? "TIMEOUT" : "NETWORK",
      message: isTimeout ? "OpenAI call timed out." : "Network error calling OpenAI.",
      retryable: true,
      detail: { name: e?.name, message: e?.message }
    };
  } finally {
    clearTimeout(timeout);
  }
}