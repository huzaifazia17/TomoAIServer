import mongoose from 'mongoose';

const chatPlusSchema = new mongoose.Schema({
    firebaseUid: {
        type: String,
        required: true,
    },
    chatPlusId: {
        type: String,
        required: true,
        unique: true,
    },
    spaceId: {
        type: String,
        required: true,
    },
    chatPlusName: {
        type: String,
        required: true,
    },
    users: {
        type: [String], 
        required: true,
        default: [], 
    },
}, {
    timestamps: true,
});

export default mongoose.models.chatPlus || mongoose.model('chatPlus', chatPlusSchema);