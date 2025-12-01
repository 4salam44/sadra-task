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

const personalTaskLogSchema = new mongoose.Schema(
  {
    personalTaskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PersonalTask',
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: ['session', 'note', 'milestone', 'detail-update'],
      default: 'note',
    },
    title: { type: String, trim: true },
    description: { type: String, trim: true },
    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date },
    durationMinutes: { type: Number, default: 0 },
    progress: { type: Number, min: 0, max: 100 },
    attachments: { type: [attachmentSchema], default: [] },
    isSharedWithAdmin: { type: Boolean, default: false },
    sharedAt: { type: Date },
    metadata: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true }
);

personalTaskLogSchema.index({ personalTaskId: 1, createdAt: -1 });
personalTaskLogSchema.index({ userId: 1, startedAt: -1 });

export default mongoose.model('PersonalTaskLog', personalTaskLogSchema);

