const express = require('express');
const cors = require('cors');
require('dotenv').config(); // Load environment variables

// Import LlamaAI dynamically for ESM compatibility
let LlamaAI;
(async () => {
    try {
        LlamaAI = (await import('llamaai')).default;
    } catch (error) {
        console.error("Error loading LlamaAI module:", error);
        process.exit(1); // Exit if LlamaAI can't be loaded
    }
})();

const app = express();
const port = 3001; // Define your port

// Middleware setup
app.use(cors()); // Enable CORS for frontend-backend communication
app.use(express.json()); // Parse incoming JSON requests

// POST route for chatbot
app.post('/api/chat', async (req, res) => {
    try {
        const { prompt } = req.body; // Get the user prompt from the request body

        // Ensure the prompt is provided
        if (!prompt) {
            return res.status(400).json({ error: "Prompt is required" });
        }

        // Initialize the LlamaAI instance with your API key
        const llamaAPI = new LlamaAI(process.env.LLAMA_API_KEY);

        // Create the API request payload
        const apiRequestJson = {
            messages: [{ role: 'user', content: prompt }], // The user's message
            stream: false, // Disable streaming of responses
        };

        // Log the API request body for debugging purposes
        console.log("Sending request to LLaMA API:", JSON.stringify(apiRequestJson, null, 2));

        // Send the request to the LLaMA model
        const response = await llamaAPI.run(apiRequestJson);

        // Check if the response is valid and contains a message
        const messageContent = response.choices[0]?.message?.content || "No response from AI";

        // Log the full API response
        console.log("API Response:", JSON.stringify(response, null, 2));

        // Return the AI response to the client
        res.json({ message: messageContent });
    } catch (error) {
        console.error("Error in AI request:", error.message || error);
        res.status(500).json({ error: 'Failed to process request' });
    }
});

// Start the Express server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
