// This is a temporary diagnostic function to check the library version.
exports.handler = async function (event, context) {
  // Try to get the version number from the installed library
  let version = 'not found';
  try {
    version = require('@google/generative-ai/package.json').version;
  } catch (e) {
    version = `Error finding version: ${e.message}`;
  }

  const responseMessage = {
    message: "This is the diagnostic test running!",
    googleAiLibraryVersion: version
  };

  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
    body: JSON.stringify(responseMessage),
  };
};
