import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  firebaseUid: {
    type: String,
    required: true,
    unique: true, 
  },
  firstName: {
    type: String,
    required: true,
  },
  lastName: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true, 
  },
  role: {
    type: String,
    enum: ['student', 'ta', 'professor'],
    required: true,
  },
}, {
  timestamps: true,
});

export default mongoose.models.User || mongoose.model('User', userSchema);