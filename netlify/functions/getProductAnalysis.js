const { GoogleGenerativeAI } = require("@google/generative-ai");

// Helper function to call a specific AI model
async function callGenerativeAI(apiKey, modelName, prompt) {
  const genAI = new GoogleGenerativeAI(apiKey);
  // Add generationConfig to control the model's behavior
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      temperature: 0.2, // Lower temperature = less creative, more consistent
      topP: 0.95,
      topK: 40,
    },
  });

  const result = await model.generateContent(prompt);
  const response = await result.response;
  let text = response.text();
  // Clean up the response to ensure it's valid JSON
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

  // This is the new, improved "Super Prompt" with a high-quality example
  const prompt = `
    You are an expert e-commerce product research analyst. Your analysis must be factual, data-driven, and consistent.

    HERE IS AN EXAMPLE OF A PERFECT ANALYSIS:
    ---
    EXAMPLE INPUT:
    - Product Name: "Stainless Steel Water Bottle"
    - Target Market: "USA"
    - Business Model: "Amazon FBA"

    EXAMPLE OUTPUT (JSON):
    {
      "pros": [
        "Evergreen demand driven by health, fitness, and environmental trends.",
        "High perceived value and strong potential for branding and customization.",
        "Simple to source and relatively low-risk product category."
      ],
      "cons": [
        "Extremely saturated market with intense competition from established brands.",
        "Low differentiation for basic models, requiring investment in unique design or features.",
        "Price-sensitive category, leading to pressure on profit margins."
      ],
      "factors": {
        "riskScore": { "score": 8, "reason": "The product itself is very safe. The main risks are purely financial and competitive, not legal or safety-related." },
        "seasonality": { "score": 10, "reason": "Demand is year-round, with minor peaks in summer and back-to-school seasons." },
        "differentiation": { "score": 6, "reason": "While the basic product is a commodity, there is strong potential to differentiate through unique lids, insulation technology, colors, and branding." },
        "audienceSize": { "score": 10, "reason": "The audience is massive and diverse, including students, athletes, office workers, and outdoor enthusiasts." },
        "marketingAngle": { "score": 8, "reason": "Multiple strong angles are available: eco-friendly (reusable), health (BPA-free), lifestyle (fitness/yoga), and style." },
        "urgency": { "score": 4, "reason": "This is a 'want' not a 'need' purchase. Urgency is low, driven by lifestyle choices or replacing a lost item." },
        "longevity": { "score": 9, "reason": "This is a timeless product category with durable demand that is unlikely to become obsolete." },
        "brandingPotential": { "score": 9, "reason": "Excellent potential. Many successful brands (Hydro Flask, Stanley) have been built in this category." },
        "complianceRisk": { "score": 5, "reason": "Very low risk. The main requirement is ensuring materials are food-grade certified (e.g., FDA compliant), which is standard for most suppliers." }
      }
    }
    ---

    NOW, USING THAT EXAMPLE AS A GUIDE, PERFORM THE SAME ANALYSIS FOR THE FOLLOWING PRODUCT.
    Your entire response MUST be a single, valid JSON object with no other text or markdown formatting.

    NEW INPUT:
    - Product Name: "${productName}"
    - Target Market: "${targetMarket || 'USA'}"
    - Business Model: "${businessModel || 'Amazon FBA'}"
  `;

  try {
    let data;
    const primaryModel = "gemini-2.5-pro";
    const fallbackModel = "gemini-2.5-flash";
    const TIMEOUT_MS = 9000;

    try {
      console.log(`Attempt 1: Trying primary model (${primaryModel}) with a ${TIMEOUT_MS/1000}s timeout.`);
      data = await Promise.race([
        callGenerativeAI(API_KEY, primaryModel, prompt),
        timeout(TIMEOUT_MS)
      ]);
    } catch (error) {
      console.warn(`Primary model failed or timed out. Reason: ${error.message}. Trying fallback model (${fallbackModel}).`);
      data = await callGenerativeAI(API_KEY, fallbackModel, prompt);
    }

    return { statusCode: 200, headers, body: JSON.stringify(data) };

  } catch (error) {
    console.error("All AI models failed to generate a response:", error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Failed to get analysis from AI after multiple attempts.", details: error.message })};
  }
};
