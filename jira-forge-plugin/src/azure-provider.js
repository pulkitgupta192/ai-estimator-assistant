// azure-provider.js
import fetch from "node-fetch";

export async function azureEstimate(summary, description, model) {
  const key = process.env.AZURE_OPENAI_KEY;
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;

  if (!key || !endpoint || !deployment) {
    return {
      ok: false,
      code: "CONFIG",
      message: "Missing Azure OpenAI configuration.",
      retryable: false
    };
  }

  const url = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=2024-02-15-preview`;

  const prompt = `
Estimate development effort in hours.
Summary:
${summary}

Description:
${description}

Return only a number.
  `.trim();

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": key
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2
      })
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        ok: false,
        code: "AI_UPSTREAM",
        message: data?.error?.message ?? "Azure OpenAI request failed.",
        retryable: response.status >= 500 || response.status === 429,
        detail: data
      };
    }

    const raw = data?.choices?.[0]?.message?.content?.trim();
    const match = raw?.match(/-?\d+(\.\d+)?/);

    if (!match) {
      return {
        ok: false,
        code: "AI_PARSE",
        message: "Azure OpenAI did not return a numeric effort.",
        retryable: true,
        detail: { raw }
      };
    }

    return { ok: true, effort: Number(match[0]), raw };

  } catch (e) {
    return {
      ok: false,
      code: "NETWORK",
      message: "Network error calling Azure OpenAI.",
      retryable: true,
      detail: { name: e?.name, msg: e?.message }
    };
  }
}