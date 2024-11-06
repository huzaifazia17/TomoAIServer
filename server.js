const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const OpenAI = require('openai');
const pdfParse = require('pdf-parse');
const fs = require('fs');
const multer = require('multer');
const fetch = require('node-fetch'); // To make API calls
require('dotenv').config(); // Load environment variables


const app = express();
const port = 3009; // Define your port

// Configure file upload using multer
const upload = multer({ dest: 'uploads/' });

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
  firebaseUid: {
    type: String,
    required: true,
  },
  spaceId: {
    type: String,
    required: true,
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

    // Fetch all spaces where the users array includes the current user's firebaseUid
    const spaces = await Space.find({ users: firebaseUid });

    // Return the spaces as an array in an object
    res.status(200).json({ spaces });
  } catch (error) {
    console.error('Error fetching spaces:', error);
    res.status(500).json({ message: 'Server error' });
  }
});


// GET route to fetch a specific space by spaceId
app.get('/api/spaces/:spaceId', async (req, res) => {
  try {
    const { spaceId } = req.params;
    const space = await Space.findOne({ spaceId });

    if (!space) {
      return res.status(404).json({ message: 'Space not found' });
    }

    res.status(200).json(space);
  } catch (error) {
    console.error('Error fetching space:', error);
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
/* // PUT route to add users to a space
app.put('/api/spaces/:spaceId/users', async (req, res) => {
  try {
    const { spaceId } = req.params;
    const { users } = req.body;

    if (!Array.isArray(users) || users.length === 0) {
      return res.status(400).json({ message: 'Invalid or empty users array' });
    }

    const space = await Space.findOneAndUpdate(
      { spaceId },
      { $addToSet: { users: { $each: users } } }, // Use $addToSet to add users without duplicates
      { new: true }
    );

    if (!space) {
      return res.status(404).json({ message: 'Space not found' });
    }

    res.status(200).json(space);
  } catch (error) {
    console.error('Error adding users to space:', error);
    res.status(500).json({ message: 'Server error' });
  }
}); */
app.put('/api/spaces/:spaceId/users', async (req, res) => {
  try {
    const { spaceId } = req.params;
    const { userId } = req.body; // Make sure this is named `userId` to match what you send from the frontend

    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    // Update the space to add the userId (firebaseUid) to the users array
    const space = await Space.findOneAndUpdate(
      { spaceId },
      { $addToSet: { users: userId } }, // $addToSet ensures no duplicates
      { new: true }
    );

    if (!space) {
      return res.status(404).json({ message: 'Space not found' });
    }

    res.status(200).json(space);
  } catch (error) {
    console.error('Error adding user to space:', error);
    res.status(500).json({ message: 'Server error' });
  }
});





// DELETE route to remove a user from a space
app.delete('/api/spaces/:spaceId/users/:userId', async (req, res) => {
  try {
    const { spaceId, userId } = req.params;

    const space = await Space.findOneAndUpdate(
      { spaceId },
      { $pull: { users: userId } }, // Remove userId from the array
      { new: true }
    );

    if (!space) {
      return res.status(404).json({ message: 'Space not found' });
    }

    res.status(200).json(space);
  } catch (error) {
    console.error('Error removing user from space:', error);
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


app.post('/api/chats', async (req, res) => {
  try {
    const { firebaseUid, spaceId, chatId, chatName } = req.body;

    // Validate required fields
    if (!firebaseUid || !spaceId || !chatId || !chatName) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Create a new chat
    const newChat = new Chat({ firebaseUid, spaceId, chatId, chatName });
    await newChat.save();

    res.status(201).json(newChat);
  } catch (error) {
    console.error('Error creating chat:', error);
    res.status(500).json({ message: 'Server error' });
  }
});


app.get('/api/chats', async (req, res) => {
  try {
    const { firebaseUid, spaceId } = req.query;

    if (!firebaseUid || !spaceId) {
      return res.status(400).json({ message: 'firebaseUid and spaceId are required' });
    }

    // Fetch chats for the space and user
    const chats = await Chat.find({ firebaseUid, spaceId });

    res.status(200).json({ chats });
  } catch (error) {
    console.error('Error fetching chats:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.delete('/api/chats/:chatId', async (req, res) => {
  try {
    const { chatId } = req.params;

    // Find and delete the chat by chatId
    const deletedChat = await Chat.findOneAndDelete({ chatId });

    if (!deletedChat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    res.status(200).json({ message: 'Chat deleted successfully' });
  } catch (error) {
    console.error('Error deleting chat:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Server.js or your main server file
app.put('/api/chats/:chatId', async (req, res) => {
  try {
    const { chatId } = req.params;
    const { chatName } = req.body;

    if (!chatName) {
      return res.status(400).json({ message: 'Chat name is required' });
    }

    // Update the chat in the database
    const updatedChat = await Chat.findOneAndUpdate(
      { chatId }, // Find the chat by its unique chatId
      { chatName }, // Update the chat name
      { new: true } // Return the updated document
    );

    if (!updatedChat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    res.status(200).json(updatedChat);
  } catch (error) {
    console.error('Error updating chat name:', error);
    res.status(500).json({ message: 'Server error' });
  }
});


// Endpoint to generate embeddings and save to the database
app.post('/api/embeddings', async (req, res) => {
  try {
    const { spaceId, title, text } = req.body;

    if (!spaceId || !title || !text) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Generate embeddings using OpenAI API
    const response = await openai.createEmbedding({
      model: 'text-embedding-3-small', // test model
      input: text,
    });

    const embeddings = response.data.data[0].embedding;

    // Save the embeddings to the database
    const newEmbedding = new Embedding({ spaceId, title, embeddings });
    await newEmbedding.save();

    res.status(201).json({ id: newEmbedding._id });
  } catch (error) {
    console.error('Error generating embeddings:', error);
    res.status(500).json({ message: 'Failed to generate embeddings' });
  }
});

// Endpoint to fetch documents for a specific space
app.get('/api/documents', async (req, res) => {
  try {
    const { spaceId } = req.query;
    if (!spaceId) {
      return res.status(400).json({ message: 'spaceId is required' });
    }

    // Fetch documents associated with the given spaceId
    const documents = await Embedding.find({ spaceId });
    res.status(200).json({ documents });
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Endpoint to delete a document by ID
app.delete('/api/documents/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const document = await Embedding.findByIdAndDelete(id);

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    res.status(200).json({ message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Endpoint to upload and process PDF
app.post('/api/upload-pdf', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const { spaceId, title } = req.body;
    if (!spaceId || !title) {
      return res.status(400).json({ message: 'spaceId and title are required' });
    }

    // Read the PDF file
    const pdfBuffer = fs.readFileSync(req.file.path);
    const pdfData = await pdfParse(pdfBuffer);
    const textContent = pdfData.text;
    console.log('Extracted text from PDF:', textContent);

    // Make an API call to OpenAI to get embeddings
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'text-embedding-ada-002',
        input: textContent,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to generate embeddings');
    }

    const data = await response.json();
    const embeddings = data.data[0].embedding;

    // Save embeddings to the database
    const newEmbedding = new Embedding({
      spaceId,
      title,
      embeddings,
    });
    const savedDocument = await newEmbedding.save();
    console.log('Document saved to database:', savedDocument);

    // Delete the temporary file
    fs.unlinkSync(req.file.path);

    // Return the saved document as the response
    res.status(200).json(savedDocument);
  } catch (error) {
    console.error('Error processing the PDF:', error);
    res.status(500).json({ message: 'Server error' });
  }
});



// Start the Express server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
