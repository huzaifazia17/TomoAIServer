import mongoose from 'mongoose';

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

export default mongoose.models.Space || mongoose.model('Space', spaceSchema);