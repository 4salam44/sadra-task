import mongoose from 'mongoose';

const taskProgressSchema = new mongoose.Schema({
  taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: {
    type: String,
    enum: ['started', 'request', 'completed', 'admin-response', 'returned', 'detail-update'],
    required: true,
  },
  message: { type: String },
  statusSnapshot: {
    type: String,
    enum: ['pending', 'in-progress', 'completed', 'late', 'returned'],
  },
  metadata: mongoose.Schema.Types.Mixed,
  attachments: [{
    filename: String,
    originalName: String,
    mimeType: String,
    size: Number,
    url: String,
    uploadedAt: { type: Date, default: Date.now },
  }],
}, { timestamps: true });

export default mongoose.model('TaskProgress', taskProgressSchema);

