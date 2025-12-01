import mongoose from 'mongoose';

const detailSchema = new mongoose.Schema(
  {
    text: { type: String, trim: true, required: true },
    isCompleted: { type: Boolean, default: false },
    note: { type: String, trim: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const timerConfigSchema = new mongoose.Schema(
  {
    label: { type: String, trim: true },
    durationMinutes: { type: Number, min: 1 },
    autoStart: { type: Boolean, default: false },
  },
  { _id: false }
);

const personalTaskSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, trim: true, required: true },
    description: { type: String, trim: true },
    category: { type: String, trim: true },
    priority: { type: Number, min: 1, max: 3, default: 2 },
    status: { type: String, enum: ['pending', 'in-progress', 'completed'], default: 'pending' },
    dueDate: { type: Date },
    reminderAt: { type: Date },
    details: { type: [detailSchema], default: [] },
    timerConfig: timerConfigSchema,
    sharedWith: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    allowSharedEdit: { type: Boolean, default: false },
    isSharedWithAdmin: { type: Boolean, default: false },
    reportSummary: {
      totalMinutes: { type: Number, default: 0 },
      lastLogAt: { type: Date },
      sharedLogCount: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

personalTaskSchema.index({ userId: 1, dueDate: 1 });
personalTaskSchema.index({ sharedWith: 1 });

export default mongoose.model('PersonalTask', personalTaskSchema);