import mongoose from 'mongoose';

const embeddingSchema = new mongoose.Schema({
    spaceId: {
        type: String,
        required: true,
    },
    title: {
        type: String,
        required: true,
    },
    embeddings: {
        type: [[Number]], // 2D array where each sub-array represents the embeddings for a chunk
        required: true,
    },
    content: {
        type: [String], // Array of content chunks, aligned with embeddings
        required: true,
    },
}, {
    timestamps: true,
});


export default mongoose.models.Embedding || mongoose.model('Embedding', embeddingSchema);
