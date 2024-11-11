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
        type: [[Number]], // 2D array for embeddings
        required: true,
    },
    content: {
        type: [String], // Array of content chunks
        required: true,
    },
    visibility: {
        type: Boolean,
        default: true, // By default, documents are visible
    },
}, {
    timestamps: true,
});


export default mongoose.models.Embedding || mongoose.model('Embedding', embeddingSchema);
