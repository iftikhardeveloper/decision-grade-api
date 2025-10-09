const { GoogleGenerativeAI } = require("@google/generative-ai");

// Helper function to call a specific AI model
async function callGenerativeAI(apiKey, modelName, prompt) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelName });
  const result = await model.generateContent(prompt);
  const response = await result.response;
  let text = response.text();
  // Clean up the response to ensure it's valid JSON
  text = text.replace(/```json/g, '').replace(/```/g, '').trim();
  return JSON.parse(text);
}

exports.handler = async function (event, context) {
  // Standard headers for CORS
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

  // Define the factors for the AI prompt
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

  // The main prompt sent to the AI
  const prompt = `
    You are an expert e-commerce product research analyst.
    Analyze the product named "${productName}" with the following business context:
    - Target Market: "${targetMarket || 'USA'}"
    - Business Model: "${businessModel || 'Amazon FBA'}"

    First, provide a high-level summary with 3 pros and 3 cons for this product idea in bullet points.
    Second, provide a detailed analysis for the 9 factors listed below. For each factor, provide a "score" (number) and a brief "reason" (string).

    The factors to analyze are:
    ${Object.entries(factors).map(([key, desc]) => `- ${key}: ${desc}`).join('\n')}

    Your entire response MUST be a single, valid JSON object with no other text.
    The JSON must have three top-level keys: "pros", "cons", and "factors".
    - "pros" and "cons" must be arrays of strings.
    - "factors" must be an object where each key is a factor name.
    - The value for each factor must be an object with a "score" and a "reason".
  `;

  try {
    let data;
    // --- START OF THE FALLBACK CHAIN LOGIC ---
    try {
      console.log("Attempt 1: Trying primary model (gemini-2.5-pro)");
      data = await callGenerativeAI(API_KEY, "gemini-2.5-pro", prompt);
    } catch (primaryError) {
      console.warn("Primary model failed. Trying first backup (gemini-2.5-flash). Error:", primaryError.message);
      try {
        data = await callGenerativeAI(API_KEY, "gemini-2.5-flash", prompt);
      } catch (secondaryError) {
        console.warn("First backup failed. Trying second backup (gemini-2.0-flash). Error:", secondaryError.message);
        // This is the final attempt. If it fails, the outer catch block will handle it.
        data = await callGenerativeAI(API_KEY, "gemini-2.0-flash", prompt);
      }
    }
    // --- END OF THE FALLBACK CHAIN LOGIC ---

    return { statusCode: 200, headers, body: JSON.stringify(data) };

  } catch (error) {
    console.error("All AI models failed to generate a response:", error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Failed to get analysis from AI after multiple attempts.", details: error.message })};
  }
};
