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

const taskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    priority: { type: Number, enum: [1, 2, 3], default: 2 },
    status: {
      type: String,
      enum: ['pending', 'in-progress', 'completed', 'late', 'returned'],
      default: 'pending',
    },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    assignees: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    dueDate: { type: Date },
    details: { type: [detailSchema], default: [] },
  },
  { timestamps: true }
);

taskSchema.pre('save', function ensurePrimaryInAssignees(next) {
  if (!Array.isArray(this.assignees)) {
    this.assignees = [];
  }

  if (this.assignedTo) {
    const primaryId = this.assignedTo.toString();
    const assigneesSet = new Set(this.assignees.map((id) => id.toString()));
    if (!assigneesSet.has(primaryId)) {
      this.assignees.push(this.assignedTo);
      assigneesSet.add(primaryId);
    }

    const uniqueIds = Array.from(assigneesSet);
    this.assignees = uniqueIds.map((id) => new mongoose.Types.ObjectId(id));
  }

  next();
});

taskSchema.index({ assignedTo: 1, status: 1 });
taskSchema.index({ dueDate: 1 });

export default mongoose.model('Task', taskSchema);