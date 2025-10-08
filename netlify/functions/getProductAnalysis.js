const { GoogleGenerativeAI } = require("@google/generative-ai");

// This is the final, working function.
exports.handler = async function (event, context) {
  // Allow requests from any origin (for the Chrome extension)
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  // Handle pre-flight requests for CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers,
      body: '',
    };
  }

  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "API key is not configured." }),
    };
  }

  let productName;
  try {
    const body = JSON.parse(event.body);
    productName = body.productName;
  } catch (error) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Invalid request body." }),
    };
  }

  if (!productName || productName.trim() === "") {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "productName is required." }),
    };
  }

  const prompt = `
    You are an expert product research analyst for e-commerce.
    Analyze the product named "${productName}" based on the following 9 factors.
    Provide a numerical score or value for each factor based on public data and general market understanding.

    Factors to analyze:
    1.  riskScore: A score from 1 (very risky) to 10 (very safe).
    2.  seasonality: A score from 0 (not seasonal) to 100 (extremely seasonal).
    3.  differentiation: A score from 0 (commodity) to 10 (highly unique).
    4.  audienceSize: A score from 0 (niche) to 10 (massive audience).
    5.  marketingAngle: A score from 0 (hard to market) to 10 (many strong angles).
    6.  urgency: A score from 0 (optional) to 10 (solves an urgent problem).
    7.  longevity: A score from 0 (fad product) to 10 (long-term demand).
    8.  brandingPotential: A score from 0 (unbrandable) to 10 (strong brand potential).
    9.  complianceRisk: A score from 0 (no risk) to 100 (very high risk).

    Your response MUST be a valid JSON object.
    Do not include any text, explanation, or markdown formatting like \`\`\`json before or after the JSON object.
    The keys must exactly match the factor names provided.
  `;

  try {
    const genAI = new GoogleGenerativeAI(API_KEY);
    // Use the correct model name we just found
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();

    text = text.replace(/```json/g, '').replace(/```/g, '').trim();

    const data = JSON.parse(text);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(data),
    };
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Failed to get analysis from AI.", details: error.message }),
    };
  }
};
