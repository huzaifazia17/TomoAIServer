const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config(); // Load environment variables

//Test comment
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

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI).then(() => console.log('MongoDB connected')).catch((error) => console.error('MongoDB connection error:', error));

// Define User model
const userSchema = new mongoose.Schema({
  firebaseUid: {
    type: String,
    required: true,
    unique: true
  },

  firstName: {
    type: String,
    required: true
  },

  lastName: {
    type: String,
    required: true
  },

  email: {
    type: String,
    required: true,
    unique: true
  },

  role: {
    type: String,
    enum: ['student', 'ta', 'professor'],
    required: true
  },
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

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

// POST route for user registration
app.post('/api/users', async (req, res) => {
  const { firebaseUid, firstName, lastName, email, role } = req.body;

  try {
    const existingUser = await User.findOne({ firebaseUid });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const newUser = new User({
      firebaseUid,
      firstName,
      lastName,
      email,
      role,
    });

    await newUser.save();
    res.status(201).json({ message: 'User created successfully' });
  } catch (error) {
    console.error("Error saving user:", error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Start the Express server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});