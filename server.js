import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import OpenAI from 'openai';
import fs from 'fs';
import multer from 'multer';
import { OpenAIEmbeddings } from '@langchain/openai';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { Document } from "langchain/document";
import Chat from "./models/chat.js";
import Embedding from "./models/embedding.js";
import Space from "./models/space.js";
import User from "./models/user.js";
import * as dotenv from 'dotenv';
dotenv.config();

const app = express();
const port = 3009;

// Configure file upload using multer
const upload = multer({ dest: 'uploads/' });

// Middleware setup
app.use(cors()); // Enable CORS for frontend-backend communication
app.use(express.json()); // Parse incoming JSON requests

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch((error) => console.error('MongoDB connection error:', error));

// Initialize OpenAI API client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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


app.post('/api/chat', async (req, res) => {
  try {
    const { prompt, spaceId } = req.body;

    if (!spaceId) {
      return res.status(400).json({ error: "spaceId is required" });
    }

    // Fetch all document data for the specified spaceId
    const embeddingsData = await Embedding.find({ spaceId });
    if (!embeddingsData || embeddingsData.length === 0) {
      console.error("No embeddings found for spaceId:", spaceId);
      return res.status(404).json({ error: "No embeddings found for the specified space" });
    }
    console.log("Fetched embeddings for space:", embeddingsData.length);

    // Check if only sample questions are needed (when `prompt` is empty)
    if (!prompt) {
      // Generate sample questions based on document content
      const sampleQuestionsPrompt = embeddingsData.map((data) => data.content).join(' ');
      const sampleQuestionsResponse = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'user', content: `Generate 3 unique, concise questions with less than 12 words based on the following content without numbering each question:\n${sampleQuestionsPrompt}` },
        ],
      });

      const sampleQuestions = sampleQuestionsResponse.choices[0].message.content
        .split('\n')
        .map((question) => question.replace(/^\d+\.\s*/, '').trim()) // Remove numbering at the start of each question
        .filter((line) => line.length > 0) // Keep only non-empty lines
        .slice(0, 3); // Limit to 3 questions

      return res.json({ sampleQuestions });
    }

    // Proceed with normal chat response if `prompt` is provided
    const embeddingsClient = new OpenAIEmbeddings({ apiKey: process.env.OPENAI_API_KEY });

    // Convert embeddings and content to LangChain Document format
    const documents = embeddingsData.flatMap(data =>
      data.embeddings.map((embedding, index) => new Document({
        pageContent: data.content[index],
        metadata: { spaceId: data.spaceId }
      }))
    );

    // Create a vector store with the embeddings
    const vectorStore = new MemoryVectorStore(embeddingsClient);
    await vectorStore.addDocuments(documents);

    // Similarity search to find relevant document content
    let results;
    try {
      results = await vectorStore.similaritySearch(prompt, 3);
      console.log("Similarity search results:", results);
    } catch (error) {
      console.error("Error during similarity search:", error);
      return res.status(500).json({ error: "Error during similarity search", details: error.message });
    }

    // Construct context from results
    const context = results.map(result => `Content: ${result.pageContent}`).join('\n\n');
    console.log("Constructed context for OpenAI:", context);

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are a helpful assistant that answers clearly.' },
        { role: 'user', content: context ? `Context:\n${context}\n\nQuestion: ${prompt}` : prompt },
      ],
    });

    const aiResponse = response.choices[0].message.content || "No response from AI";
    res.json({ message: aiResponse });

  } catch (error) {
    console.error("Error in AI request:", error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});





//Image stuff
/* app.post('/api/chat', async (req, res) => {
  try {
    const { prompt, spaceId } = req.body;

    if (!prompt || !spaceId) {
      return res.status(400).json({ error: "Prompt and spaceId are required" });
    }

    console.log("Received prompt:", prompt);
    console.log("Received spaceId:", spaceId);

    // Fetch all document data for the specified spaceId
    const embeddingsData = await Embedding.find({ spaceId });
    if (!embeddingsData || embeddingsData.length === 0) {
      console.error("No embeddings found for spaceId:", spaceId);
      return res.status(404).json({ error: "No embeddings found for the specified space" });
    }

    console.log("Fetched embeddings for space:", embeddingsData.length);

    // Initialize OpenAI embeddings client
    const embeddingsClient = new OpenAIEmbeddings({ apiKey: process.env.OPENAI_API_KEY });

    // Convert embeddings to Document format
    const documents = embeddingsData.flatMap(data =>
      data.embeddings.map((embedding, index) => new Document({
        pageContent: data.content[index],
        metadata: { spaceId: data.spaceId }
      }))
    );

    // Create a vector store and add documents to it
    const vectorStore = new MemoryVectorStore(embeddingsClient);
    await vectorStore.addDocuments(documents);

    // Similarity search for relevant document content
    let results;
    try {
      results = await vectorStore.similaritySearch(prompt, 3);
      console.log("Similarity search results:", results);
    } catch (error) {
      console.error("Error during similarity search:", error);
      return res.status(500).json({ error: "Error during similarity search", details: error.message });
    }

    const context = results.map(result => `Content: ${result.pageContent}`).join('\n\n');
    console.log("Constructed context for OpenAI:", context);

    // Check if the prompt suggests an image generation request
    const needsImageGeneration = /create an image|graph|chart|diagram/i.test(prompt);

    if (needsImageGeneration) {
      try {
        const imageResponse = await fetch("https://api.openai.com/v1/images/generations", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            prompt: prompt, // Use the prompt directly
            n: 1,
            size: "512x512", // Adjust size as needed
            response_format: "url"
          })
        });

        if (!imageResponse.ok) {
          throw new Error("Failed to generate image.");
        }

        const imageData = await imageResponse.json();
        const imageUrl = imageData.data[0].url;

        console.log("Generated image URL:", imageUrl);

        return res.json({
          message: "Here's the generated image you requested along with additional context:",
          imageUrl: imageUrl,
        });
      } catch (imageError) {
        console.error("Error generating image:", imageError);
        return res.status(500).json({ error: "Error generating image", details: imageError.message });
      }
    }

    // Text-only response if no image is requested
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are a helpful assistant that can respond with images if requested, along with text explanations.' },
        { role: 'user', content: context ? `Context:\n${context}\n\nQuestion: ${prompt}` : prompt },
      ],
    });

    const aiResponse = response.choices[0].message.content || "No response from AI";
    res.json({ message: aiResponse });

  } catch (error) {
    console.error("Error in AI request:", error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}); */

//Threshold code
/* 
app.post('/api/chat', async (req, res) => {
  try {
    const { prompt, spaceId } = req.body;

    if (!prompt || !spaceId) {
      return res.status(400).json({ error: "Prompt and spaceId are required" });
    }

    console.log("Received prompt:", prompt);
    console.log("Received spaceId:", spaceId);

    // Fetch stored embeddings and content for the specified spaceId
    const embeddingsData = await Embedding.findOne({ spaceId });

    // If no embeddings data or no content, proceed with general question
    if (!embeddingsData || embeddingsData.embeddings.length === 0) {
      console.log("No embeddings found for space; proceeding with general question.");

      // Respond directly to OpenAI without document context
      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'You are a helpful assistant that can answer questions based on documents or provide general assistance.' },
          { role: 'user', content: prompt },
        ],
      });


      const aiResponse = response.choices[0].message.content || "No response from AI";
      return res.json({ message: aiResponse });
    }

    console.log("Fetched embeddings for space:", embeddingsData.embeddings.length);

    // Initialize OpenAI embeddings client
    const embeddingsClient = new OpenAIEmbeddings({ apiKey: process.env.OPENAI_API_KEY });

    // Convert stored embeddings and content to LangChain Document format
    const documents = embeddingsData.embeddings.map((embedding, index) => new Document({
      pageContent: embeddingsData.content[index], // Access corresponding content chunk
      metadata: { spaceId: embeddingsData.spaceId }
    }));

    // Create a vector store and add the documents to it
    const vectorStore = new MemoryVectorStore(embeddingsClient);
    await vectorStore.addDocuments(documents);

    // Try similarity search to check for relevant document content
    let results;
    let isDocumentBased = false;
    try {
      results = await vectorStore.similaritySearch(prompt, 3);
      console.log("Similarity search results:", results);
      console.log(results.score);
      // Set a threshold score to determine if the prompt matches document content
      //Higher threshold (>0.8) =>This will filter out responses that aren’t very closely matched to the document 
      //content, meaning only very relevant document-related content will be included as context.
      // Lower threshold (<0.5) =>This allows a broader range of content to match the query, 
      // so the AI may use even loosely related document content as context.
      const thresholdScore = 1; // Adjust as needed for relevance
      isDocumentBased = results.some(result => result.score >= thresholdScore);
    } catch (error) {
      console.error("Error during similarity search:", error);
      return res.status(500).json({ error: "Error during similarity search", details: error.message });
    }

    // Construct context from top matching documents' content if document-based
    const context = isDocumentBased
      ? results.map(result => `Content: ${result.pageContent}`).join('\n\n')
      : "";

    console.log("Constructed context for OpenAI:", context);

    // Send the query with or without context to OpenAI
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are a helpful assistant that can answer questions based on documents or provide general assistance.' },
        { role: 'user', content: context ? `Context:\n${context}\n\nQuestion: ${prompt}` : prompt },
      ],
    });

    const aiResponse = response.choices[0].message.content || "No response from AI";
    res.json({ message: aiResponse });
  } catch (error) {
    console.error("Error in AI request:", error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}); */


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


app.post('/api/upload-pdf', upload.single('pdf'), async (req, res) => {
  try {
    console.log("Received PDF upload request");

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const { spaceId, title } = req.body;
    if (!spaceId || !title) {
      return res.status(400).json({ message: 'spaceId and title are required' });
    }

    // Load and split PDF document
    const pdfLoader = new PDFLoader(req.file.path);
    const pdfDocument = await pdfLoader.load();
    const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000, chunkOverlap: 200 });
    const documentChunks = await splitter.splitDocuments(pdfDocument);

    console.log("Document successfully split into chunks:", documentChunks.length);

    // Initialize OpenAI Embeddings and ensure valid chunks
    const embeddingsClient = new OpenAIEmbeddings({ apiKey: process.env.OPENAI_API_KEY });
    const validChunks = documentChunks.filter(chunk => chunk.pageContent?.trim());

    if (validChunks.length === 0) {
      return res.status(400).json({ message: 'No valid content found in the PDF to embed.' });
    }

    console.log("Filtered and prepared valid document chunks:", validChunks.length);

    // Generate embeddings for each chunk and store them in arrays
    const embeddingsArray = [];
    const contentArray = [];

    for (const chunk of validChunks) {
      const chunkEmbedding = await embeddingsClient.embedDocuments([chunk.pageContent]);
      embeddingsArray.push(chunkEmbedding[0]);
      contentArray.push(chunk.pageContent);
    }

    // Save the document as a single entry in the database
    const newDocument = new Embedding({
      spaceId,
      title,
      embeddings: embeddingsArray,
      content: contentArray,
    });
    await newDocument.save();
    fs.unlinkSync(req.file.path);

    console.log("Document successfully saved to database:", newDocument._id);
    res.status(200).json({
      message: 'Document uploaded and processed successfully.',
      documentId: newDocument._id,
      title,
      spaceId,
      chunksSaved: validChunks.length,
    });
  } catch (error) {
    console.error('Error processing the PDF:', error);
    res.status(500).json({ message: 'Server error', details: error.message });
  }
});

// Route to update document visibility
app.put('/api/documents/:id/visibility', async (req, res) => {
  try {
    const { id } = req.params;
    const { visibility } = req.body;

    const updatedDocument = await Embedding.findByIdAndUpdate(
      id,
      { visibility },
      { new: true }
    );

    if (!updatedDocument) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json(updatedDocument);
  } catch (error) {
    console.error('Error updating document visibility:', error);
    res.status(500).json({ error: 'Server error' });
  }
});


// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
