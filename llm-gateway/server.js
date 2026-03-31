const express = require("express")
const { Ollama } = require("ollama")

const ollama = new Ollama({
  host: "http://127.0.0.1:11434"
})

const app = express()

app.use(express.json())

app.post("/estimate", async (req, res) => {

  const summary = req.body?.summary || ""
  const description = req.body?.description || ""

  console.log("Summary:", summary)
  console.log("Description:", description)

  const prompt = `
You are a senior software architect.

Estimate the development effort in HOURS.

Rules:
Return ONLY a number between 1 and 80.

Task Summary:
${summary}

Task Description:
${description}
`

  try {

    const response = await ollama.chat({
      model: "llama3",
      messages: [
        { role: "user", content: prompt }
      ]
    })

    const raw = response.message.content

    console.log("LLM Raw Response:", raw)

    const hoursMatch = raw.match(/\d+/)

    let hours = hoursMatch ? parseInt(hoursMatch[0]) : 8

    if (hours < 1) hours = 1
    if (hours > 80) hours = 80

    res.json({
      effort: hours.toString()
    })

  } catch (error) {

    console.error(error)

    res.json({
      effort: "8"
    })

  }

})

app.listen(8080, "0.0.0.0", () => {
  console.log("LLM Gateway running on port 8080")
})