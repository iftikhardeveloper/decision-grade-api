const { GoogleGenerativeAI } = require("@google/generative-ai");

// This is a temporary function to find out which models are available.
exports.handler = async function (event, context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "API key is not configured." })};
  }

  try {
    const genAI = new GoogleGenerativeAI(API_KEY);
    
    // This is the special command to list available models
    const modelInfo = await genAI.listModels();
    
    const modelNames = modelInfo.map(m => m.name);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ availableModels: modelNames }),
    };

  } catch (error) {
    console.error("Error listing models:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Failed to get model list.", details: error.message }),
    };
  }
};
