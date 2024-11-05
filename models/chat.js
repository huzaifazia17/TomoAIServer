import mongoose from 'mongoose';

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

export default mongoose.models.chat || mongoose.model('Chat', chatSchema);