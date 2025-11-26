import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema({
  title: String,
  description: String,
  priority: { type: Number, enum: [1, 2, 3] },
  status: { type: String, enum: ['pending', 'in-progress', 'completed', 'late'] },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  dueDate: Date
}, { timestamps: true });

export default mongoose.model('Task', taskSchema);