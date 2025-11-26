import mongoose from 'mongoose';

const personalTaskSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: String,
  description: String,
  category: String,
  priority: Number,
  status: { type: String, enum: ['pending', 'in-progress', 'completed'] },
  dueDate: Date,
  isSharedWithAdmin: { type: Boolean, default: false }
}, { timestamps: true });

export default mongoose.model('PersonalTask', personalTaskSchema);