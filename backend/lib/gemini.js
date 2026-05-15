const { GoogleGenerativeAI, SchemaType } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Analyze an email using Gemini API and return a verdict.
 * @param {string} subject - Email subject
 * @param {string} body - Email body text
 * @returns {Promise<{verdict: string, reason: string, flags: string[]}>}
 */
async function analyzeEmail(subject, body) {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          verdict: {
            type: SchemaType.STRING,
            enum: ["green", "amber", "red"],
          },
          reason: {
            type: SchemaType.STRING,
          },
          flags: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.STRING,
            },
          },
        },
        required: ["verdict", "reason", "flags"],
      },
    },
  });

  const prompt = `You are a send-regret prevention system. Analyze this email.

Subject: ${subject}
Body: ${body}

Rules:
- green = fine to send as-is
- amber = worth a second look (tone could be misread, missing a detail)  
- red = you will likely regret this (harsh tone, accusatory, vague on something important)
- reason must be blunt and specific, not generic ("This sounds annoyed" not "Consider your tone")
- flags array can be empty for green. Possible flags: "tone", "missing_context", "too_long", "passive_aggressive", "unclear_ask".`;

  const result = await model.generateContent(prompt);
  const response = result.response;
  const text = response.text();
  
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error("Failed to parse Gemini response as JSON");
  }

  // Validate structure
  if (!["green", "amber", "red"].includes(parsed.verdict)) {
    throw new Error(`Invalid verdict: ${parsed.verdict}`);
  }
  if (typeof parsed.reason !== "string") {
    throw new Error("Missing reason in response");
  }
  if (!Array.isArray(parsed.flags)) {
    parsed.flags = [];
  }

  return parsed;
}

module.exports = { analyzeEmail };
