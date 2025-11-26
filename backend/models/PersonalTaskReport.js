import mongoose from 'mongoose';

const personalTaskReportSchema = new mongoose.Schema({
  personalTaskId: { type: mongoose.Schema.Types.ObjectId, ref: 'PersonalTask' },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  completionPercentage: Number,
  notes: String,
  attachments: [String],
  sentToAdmin: { type: Boolean, default: true },
  adminViewed: { type: Boolean, default: false }
}, { timestamps: true });

export default mongoose.model('PersonalTaskReport', personalTaskReportSchema);