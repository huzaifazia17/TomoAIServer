const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
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
const port = 3009; // Define your port

// Middleware setup
app.use(cors()); // Enable CORS for frontend-backend communication
app.use(express.json()); // Parse incoming JSON requests

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch((error) => console.error('MongoDB connection error:', error));

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

// POST route for chatbot using LlamaAI package
app.post('/api/chat', async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    const apiKey = process.env.LLAMA_API_KEY;
    if (!apiKey) {
      console.error("No API key found in environment variables.");
      return res.status(500).json({ error: "No API key found" });
    }

    // Initialize the LlamaAI instance with your API key
    const llamaAPI = new LlamaAI(apiKey);
    const apiRequestJson = {
      model: 'llama3.2-3b', // Replace with the correct model ID
      messages: [{ role: 'user', content: prompt }]
    };

    console.log("Sending request to LLaMA API:", JSON.stringify(apiRequestJson, null, 2));
    const response = await llamaAPI.run(apiRequestJson);
    const messageContent = response?.choices?.[0]?.message?.content || "No response from AI";

    res.json({ message: messageContent });
  } catch (error) {
    console.error("Error in AI request:", error); // Log the complete error object
    res.status(500).json({ error: 'Internal server error', details: error.message, stack: error.stack });
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
// GET route to retrieve all users or just the current user's role
app.get('/api/users', async (req, res) => {
  try {
    const { roleOnly } = req.query;

    // If roleOnly is true, return the current user's role only
    if (roleOnly === 'true') {
      const user = await User.findOne({ firebaseUid: req.user.uid }); // Assumes req.user.uid is set by authentication middleware
      if (!user) {
        console.log("User not found with firebaseUid:", req.user.uid);
        return res.status(404).json({ message: 'User not found' });
      }
      console.log("User role fetched:", user.role);
      return res.json({ role: user.role });
    }

    // Otherwise, return all users
    const users = await User.find({});
    res.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: 'Server error' });
  }
});


// GET route to retrieve user role based on firebaseUid
app.get('/api/users/:firebaseUid', async (req, res) => {
  try {
    const { firebaseUid } = req.params;
    console.log("Fetching user with firebaseUid:", firebaseUid); // Log the firebaseUid being searched

    const user = await User.findOne({ firebaseUid });
    if (!user) {
      console.log("User not found with firebaseUid:", firebaseUid);
      return res.status(404).json({ message: 'User not found' });
    }

    console.log("User found:", user); // Log the found user document
    res.json({ role: user.role });
  } catch (error) {
    console.error("Error retrieving user:", error);
    res.status(500).json({ message: 'Server error' });
  }
});



// Start the Express server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
