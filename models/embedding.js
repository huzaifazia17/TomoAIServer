import mongoose from 'mongoose';

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

export default mongoose.models.Embedding || mongoose.model('Embedding', embeddingSchema);
