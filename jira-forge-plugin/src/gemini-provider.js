import { fetch } from '@forge/api';

export async function geminiEstimate(summary, description, model) {
  // Ensure your model string is exactly "gemini-1.5-flash"
  const GEMINI_KEY = process.env.GEMINI_API_KEY;

  const prompt = `Estimate development effort in hours.
    Summary: ${summary}
    Description: ${description}
    Return ONLY a single number representing hours.`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`;

  const response = await fetch(
  `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": GEMINI_KEY
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }]
        }
      ]
    })
  }
);

  // Log the status code to catch 404s or 403s early
  console.log(`Gemini API Status: ${response.status} ${response.statusText}`);

  const text = await response.text();
  console.log("Gemini Raw Response:", text);

  try {
    const data = JSON.parse(text);
    // Gemini 1.5 response structure: candidates[0].content.parts[0].text
    const result = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return result ? result.trim() : "4";
  } catch (e) {
    console.error("Failed to parse Gemini response", e);
    return "4";
  }
}