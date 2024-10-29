const axios = require('axios');
require('dotenv').config(); // Load environment variables

// Check if API key is available
const apiKey = process.env.LLAMA_API_KEY;
if (!apiKey) {
    console.error("No API key found in environment variables.");
    process.exit(1);
}

// Define the API endpoint and request payload
const apiEndpoint = 'https://api.llama.ai/v1/chat';
const apiRequestJson = {
    model: 'llama3.2-3b', // Replace with the correct model ID if necessary
    messages: [{ role: 'user', content: 'Hello, how are you?' }]
};

// Function to send request
async function sendRequest() {
    try {
        console.log("Sending request to LLaMA API with Axios:", JSON.stringify(apiRequestJson, null, 2));
        const response = await axios.post(apiEndpoint, apiRequestJson, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            }
        });
        console.log("API Response:", response.data);
    } catch (error) {
        console.error("Error in API request:", error.response?.data || error.message || error);
    }
}

// Send the request
sendRequest();
