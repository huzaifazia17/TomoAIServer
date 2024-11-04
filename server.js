const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const OpenAI = require('openai');
require('dotenv').config(); // Load environment variables

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

// Define Space Schema
const spaceSchema = new mongoose.Schema({
  firebaseUid: {
    type: String,
    required: true,
  },
  spaceId: {
    type: String,
    required: true,
    unique: true,
  },
  spaceName: {
    type: String,
    required: true,
  },
  users: {
    type: [String], // Array of firebaseUid strings
    required: true,
    default: [], // Initialize with an empty array
  },
}, {
  timestamps: true,
});

// Define Chat Schema
const chatSchema = new mongoose.Schema({
  spaceId: {
    type: String,
    required: true,
    unique: true,
  },
  chatId: {
    type: String,
    required: true,
    unique: true,
  },
  chatName: {
    type: String,
    required: true,
  },

}, {
  timestamps: true,
});

// Define the Embedding Schema
const embeddingSchema = new mongoose.Schema({
  spaceId: {
    type: String,
    required: true, // Associates the embeddings with a specific space
  },
  title: {
    type: String,
    required: true, // The name of the document
  },
  embeddings: {
    type: [Number], // Array of numbers representing the vector embeddings
    required: true,
  },
  uploadedBy: {
    type: String, // The firebaseUid of the user who uploaded the document
    required: true,
  },
}, {
  timestamps: true,
});

// Initiliaze DB Schemas
const User = mongoose.model('User', userSchema);
const Chat = mongoose.model('Chat', chatSchema);
const Space = mongoose.model('Space', spaceSchema);
const Embedding = mongoose.model('Embedding', embeddingSchema);

// Function to create the default space
const createDefaultSpace = async (firebaseUid) => {
  try {
    // Check if the "Personal Assistant" space already exists for the user
    const existingSpace = await Space.findOne({ firebaseUid, spaceName: "Personal Assistant" });
    if (existingSpace) {
      return; // Default space already exists, so no need to create it
    }

    // Create the default "Personal Assistant" space
    const defaultSpace = new Space({
      firebaseUid,
      spaceId: `personal-assistant-${firebaseUid}`, // Use a unique spaceId for this space
      spaceName: "Personal Assistant",
      users: [firebaseUid], // Add the user to the space's users list
    });

    await defaultSpace.save();
    console.log("Default 'Personal Assistant' space created successfully");
  } catch (error) {
    console.error("Error creating default space:", error);
  }
};



// Initialize OpenAI API client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// POST route for chatbot using OpenAI API
app.post('/api/chat', async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    // Send request to OpenAI API
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo', // Replace with your desired model
      messages: [{ role: 'user', content: prompt }],
    });

    const messageContent = response.choices[0].message.content || "No response from AI";

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

// POST route to create a new space
app.post('/api/spaces', async (req, res) => {
  try {
    const { firebaseUid, spaceId, spaceName, users } = req.body;

    // Check if a space with the same spaceId already exists
    const existingSpace = await Space.findOne({ firebaseUid, spaceId });
    if (existingSpace) {
      return res.status(400).json({ message: 'Space already exists' });
    }

    // Create a new space document
    const newSpace = new Space({
      firebaseUid,
      spaceId,
      spaceName,
      users,
    });

    await newSpace.save();
    res.status(201).json({ message: 'Space created successfully', space: newSpace });
  } catch (error) {
    console.error('Error creating space:', error);
    res.status(500).json({ message: 'Server error' });
  }
});



// Example: Call this function when a user logs in
app.post('/api/user/login', async (req, res) => {
  const { firebaseUid } = req.body;

  // Ensure the user is authenticated
  // (Add your authentication logic here)

  // Create the default space if it doesn't exist
  await createDefaultSpace(firebaseUid);

  res.status(200).json({ message: 'User logged in successfully' });
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

// GET route to fetch spaces for a specific user
app.get('/api/spaces', async (req, res) => {
  try {
    const { firebaseUid } = req.query;
    if (!firebaseUid) {
      return res.status(400).json({ message: 'firebaseUid is required' });
    }

    // Fetch all spaces for the user
    const spaces = await Space.find({ firebaseUid });
    res.status(200).json({ spaces });
  } catch (error) {
    console.error('Error fetching spaces:', error);
    res.status(500).json({ message: 'Server error' });
  }
});



// PUT route for updating a space name
app.put('/api/spaces/:spaceId', async (req, res) => {
  try {
    const { spaceId } = req.params;
    const { spaceName } = req.body;

    // Update the space name in the database
    const updatedSpace = await Space.findOneAndUpdate({ spaceId }, { spaceName }, { new: true });

    if (!updatedSpace) {
      return res.status(404).json({ message: 'Space not found' });
    }

    res.status(200).json({ message: 'Space name updated successfully' });
  } catch (error) {
    console.error('Error updating space name:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE route to delete a space
app.delete('/api/spaces/:spaceId', async (req, res) => {
  try {
    const { spaceId } = req.params;

    // Delete the space from the database
    const result = await Space.findOneAndDelete({ spaceId });
    if (!result) {
      return res.status(404).json({ message: 'Space not found' });
    }

    res.status(200).json({ message: 'Space deleted successfully' });
  } catch (error) {
    console.error('Error deleting space:', error);
    res.status(500).json({ message: 'Server error' });
  }
});







// Start the Express server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
