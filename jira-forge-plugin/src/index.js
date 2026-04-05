import api, { route } from "@forge/api";
import { estimate } from "./ai-router.js";

export const run = async (event) => {
  // ✅ Extract Issue Key correctly
  const issueKey = event.issue.key;
  console.log("Issue Key:", issueKey);

  // ✅ Fetch full issue details
  const issueResponse = await api
    .asApp()
    .requestJira(route`/rest/api/3/issue/${issueKey}`);

  const data = await issueResponse.json();

  // ✅ Extract summary
  const summary = data.fields.summary || "";

  // ✅ Extract plain-text description safely
  let description = "";
  try {
    description =
      data.fields.description?.content?.[0]?.content?.[0]?.text || "";
  } catch {
    description = "";
  }

  console.log("Summary:", summary);
  console.log("Description:", description);

  // ✅ Read Custom Field: customfield_10187 (single-select dropdown)
  const crim_type =
  data.fields["customfield_10187"]?.value ?? "Unknown";

  console.log("CRIM Type:", crim_type);

  // ✅ Call estimator WITH issueKey
  const estResult = await estimate(
	  summary,
	  description,
	  issueKey,
	  { crim_type }
	);
  console.log("Estimated Effort:", estResult);

  // ✅ Handle estimator error
  if (!estResult.ok) {
    console.log("Estimator returned error:", estResult.error);
    return estResult;
  }

  const hours = estResult.data.finalEffort;

  // ✅ Update Jira Original Estimate field
  await api.asApp().requestJira(route`/rest/api/3/issue/${issueKey}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fields: {
        timetracking: {
          originalEstimate: `${hours}h`,
        },
      },
    }),
  });

  console.log("✅ Jira Original Estimate updated.");


  return estResult;
};