const { GoogleGenerativeAI } = require("@google/generative-ai");

// Helper function to call a specific AI model
async function callGenerativeAI(apiKey, modelName, prompt) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelName });
  const result = await model.generateContent(prompt);
  const response = await result.response;
  let text = response.text();
  text = text.replace(/```json/g, '').replace(/```/g, '').trim();
  return JSON.parse(text);
}

// Helper promise for our smart timeout
const timeout = (ms) => new Promise((_, reject) => setTimeout(() => reject(new Error("Request timed out")), ms));

exports.handler = async function (event, context) {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
  if (event.httpMethod === 'OPTIONS') { return { statusCode: 204, headers, body: '' }; }

  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) { return { statusCode: 500, headers, body: JSON.stringify({ error: "API key is not configured." })}; }

  let body;
  try { body = JSON.parse(event.body); } catch (e) { return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid request body." })}; }
  
  const { productName, targetMarket, businessModel } = body;
  if (!productName) { return { statusCode: 400, headers, body: JSON.stringify({ error: "productName is required." })}; }

  const prompt = `
    You are an expert e-commerce product research analyst.
    Analyze the product named "${productName}" with the following business context:
    - Target Market: "${targetMarket || 'USA'}"
    - Business Model: "${businessModel || 'Amazon FBA'}"
    First, provide a high-level summary with 3 pros and 3 cons.
    Second, provide a detailed analysis for 9 factors. For each, provide a "score" (number) and "reason" (string).
    The factors are: riskScore (1-10 safe), seasonality (0-100 seasonal), differentiation (0-10 unique), audienceSize (0-10 massive), marketingAngle (0-10 strong), urgency (0-10 urgent), longevity (0-10 timeless), brandingPotential (0-10 strong), complianceRisk (0-100 high-risk).
    Your entire response MUST be a single, valid JSON object with no other text.
    The JSON must have "pros" (array of strings), "cons" (array of strings), and "factors" (an object).
    Inside "factors", each factor must have a "score" and "reason".
  `;

  try {
    let data;
    const primaryModel = "gemini-2.5-pro";
    const fallbackModel = "gemini-2.5-flash";
    const TIMEOUT_MS = 9000; // 9 seconds

    try {
      console.log(`Attempt 1: Trying primary model (${primaryModel}) with a ${TIMEOUT_MS/1000}s timeout.`);
      // Race the API call against our timer
      data = await Promise.race([
        callGenerativeAI(API_KEY, primaryModel, prompt),
        timeout(TIMEOUT_MS)
      ]);
    } catch (error) {
      console.warn(`Primary model failed or timed out. Reason: ${error.message}. Trying fallback model (${fallbackModel}).`);
      // If the primary fails for any reason (timeout or other error), try the fallback.
      data = await callGenerativeAI(API_KEY, fallbackModel, prompt);
    }

    return { statusCode: 200, headers, body: JSON.stringify(data) };

  } catch (error) {
    console.error("All AI models failed to generate a response:", error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Failed to get analysis from AI after multiple attempts.", details: error.message })};
  }
};
