import mongoose from 'mongoose';

const attachmentSchema = new mongoose.Schema(
  {
    filename: String,
    originalName: String,
    url: String,
    size: Number,
    mimeType: String,
  },
  { _id: false }
);

const conversationEntrySchema = new mongoose.Schema(
  {
    authorRole: { type: String, enum: ['user', 'admin'], required: true },
    message: { type: String, trim: true },
    attachments: { type: [attachmentSchema], default: [] },
  },
  { _id: true, timestamps: { createdAt: true, updatedAt: false } }
);

const personalTaskReportSchema = new mongoose.Schema(
  {
    personalTaskId: { type: mongoose.Schema.Types.ObjectId, ref: 'PersonalTask', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    completionPercentage: Number,
    notes: { type: String, trim: true },
    attachments: { type: [attachmentSchema], default: [] },
    sentToAdmin: { type: Boolean, default: true },
    adminViewed: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['submitted', 'needs-info', 'resolved'],
      default: 'submitted',
    },
    conversations: { type: [conversationEntrySchema], default: [] },
    lastAdminResponseAt: { type: Date },
    lastUserResponseAt: { type: Date },
  },
  { timestamps: true }
);

personalTaskReportSchema.index({ personalTaskId: 1, createdAt: -1 });
personalTaskReportSchema.index({ userId: 1, status: 1 });

export default mongoose.model('PersonalTaskReport', personalTaskReportSchema);