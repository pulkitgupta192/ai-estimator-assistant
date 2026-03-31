import api, { route } from "@forge/api"
import { estimate } from "./ai-router.js"

export const run = async (event) => {

  const issueKey = event.issue.key

  const issue = await api
    .asApp()
    .requestJira(route`/rest/api/3/issue/${issueKey}`)

  const data = await issue.json()

  const summary = data.fields.summary || ""

  let description = ""

  try {
    description =
      data.fields.description.content[0].content[0].text || ""
  } catch {
    description = ""
  }

  console.log("Summary:", summary)
  console.log("Description:", description)

  const effort = await estimate(summary, description)

  console.log("Estimated Effort:", effort)

  await api.asApp().requestJira(route`/rest/api/3/issue/${issueKey}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      fields: {
        timetracking: {
          originalEstimate: effort + "h"
        }
      }
    })
  })

}