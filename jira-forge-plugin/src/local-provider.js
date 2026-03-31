import fetch from "node-fetch";

export async function localEstimate(summary, description, model) {

  const url = process.env.LOCAL_LLM_URL;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      summary,
      description
    })
  });

  const data = await response.json();

  return data.effort || "4";
}