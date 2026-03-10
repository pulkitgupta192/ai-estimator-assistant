import api, { route } from "@forge/api";
import fetch from "node-fetch";

export async function run(event) {

  const issueKey = event.issue.key;

  const response = await api.asApp().requestJira(
    route`/rest/api/3/issue/${issueKey}`
  );

  const issue = await response.json();

  const summary = issue.fields.summary;

  let description = "";

  if (issue.fields.description) {
    description =
      issue.fields.description.content?.[0]?.content?.[0]?.text || "";
  }

  console.log("Summary:", summary);
  console.log("Description:", description);

  const effort = await estimateEffort(summary, description);

  await updateEstimate(issueKey, effort);
}

async function estimateEffort(summary, description) {

  const OPENAI_KEY = process.env.OPENAI_API_KEY;

  const prompt = `
Estimate development effort in hours.

Summary:
${summary}

Description:
${description}

Return only a number.
`;

  const response = await fetch(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: prompt
          }
        ]
      })
    }
  );

  const data = await response.json();

  return data.choices[0].message.content.trim();
}

async function updateEstimate(issueKey, effort) {

  await api.asApp().requestJira(
    route`/rest/api/3/issue/${issueKey}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        fields: {
          timetracking: {
            originalEstimate: `${effort}h`
          }
        }
      })
    }
  );

}