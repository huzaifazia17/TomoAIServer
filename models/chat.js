import mongoose from 'mongoose';

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

export default mongoose.models.chat || mongoose.model('Chat', chatSchema);