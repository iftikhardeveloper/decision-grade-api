const { GoogleGenerativeAI } = require("@google/generative-ai");

exports.handler = async function (event, context) {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
  if (event.httpMethod === 'OPTIONS') { return { statusCode: 204, headers, body: '' }; }

  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) { return { statusCode: 500, headers, body: JSON.stringify({ error: "API key is not configured." })}; }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (error) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid request body." })};
  }
  
  const { productName, targetMarket, businessModel } = body;
  if (!productName) { return { statusCode: 400, headers, body: JSON.stringify({ error: "productName is required." })}; }

  const factors = {
    riskScore: "A score from 1 (very risky) to 10 (very safe). Considers legal, safety, and financial risks.",
    seasonality: "A score from 0 (not seasonal) to 100 (extremely seasonal).",
    differentiation: "A score from 0 (commodity) to 10 (highly unique and defensible).",
    audienceSize: "A score from 0 (niche) to 10 (massive, mainstream audience).",
    marketingAngle: "A score from 0 (hard to market) to 10 (many strong, creative marketing angles).",
    urgency: "A score from 0 (luxury/optional) to 10 (solves an urgent, recurring problem).",
    longevity: "A score from 0 (fad product) to 10 (timeless, long-term demand).",
    brandingPotential: "A score from 0 (unbrandable) to 10 (strong potential to build a memorable brand).",
    complianceRisk: "A score from 0 (no risk) to 100 (very high risk of regulatory or platform compliance issues)."
  };

  const prompt = `
    You are an expert e-commerce product research analyst.
    Analyze the product named "${productName}" with the following business context:
    - Target Market: "${targetMarket || 'USA'}"
    - Business Model: "${businessModel || 'Amazon FBA'}"

    First, provide a high-level summary with 3 pros and 3 cons for this product idea in bullet points.

    Second, provide a detailed analysis for the following 9 factors. For each factor, provide a numerical "score" and a brief "reason" for that score.

    The factors to analyze are:
    ${Object.entries(factors).map(([key, desc]) => `- ${key}: ${desc}`).join('\n')}

    Your entire response MUST be a single, valid JSON object, with no other text or markdown formatting.
    The JSON object must have three top-level keys: "pros", "cons", and "factors".
    - "pros" and "cons" must be arrays of strings.
    - "factors" must be an object where each key is a factor name.
    - The value for each factor must be an object containing a "score" (number) and a "reason" (string).

    Example JSON structure:
    {
      "pros": ["Pro 1...", "Pro 2...", "Pro 3..."],
      "cons": ["Con 1...", "Con 2...", "Con 3..."],
      "factors": {
        "riskScore": { "score": 7, "reason": "Brief reason here..." },
        "seasonality": { "score": 80, "reason": "Brief reason here..." }
      }
    }
  `;

  try {
    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const data = JSON.parse(text);
    return { statusCode: 200, headers, body: JSON.stringify(data) };
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Failed to get analysis from AI.", details: error.message })};
  }
};
