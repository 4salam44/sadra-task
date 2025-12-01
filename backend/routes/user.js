import express from 'express';
import { body, validationResult, param } from 'express-validator';
import Task from '../models/Task.js';
import TaskProgress from '../models/TaskProgress.js';
import { authenticate } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import path from 'path';

const router = express.Router();
router.use(authenticate);

const ensureUserTask = async (taskId, userId) => {
  const task = await Task.findOne({
    _id: taskId,
    $or: [
      { assignedTo: userId },
      { assignees: userId },
    ],
  });
  if (!task) return null;
  return task;
};

router.get('/tasks', async (req, res) => {
  const tasks = await Task.find({
    $or: [
      { assignedTo: req.user._id },
      { assignees: req.user._id },
    ],
  })
    .populate('assignedBy', 'fullName username role')
    .populate('assignedTo', 'fullName username role')
    .populate('assignees', 'fullName username role')
    .sort({ priority: -1, dueDate: 1 });

  const taskIds = tasks.map((task) => task._id);

  const feedbackEntries = await TaskProgress.find({
    taskId: { $in: taskIds },
    type: { $in: ['admin-response', 'returned'] },
  })
    .populate('userId', 'fullName username role')
    .sort({ createdAt: -1 });

  const feedbackByTask = feedbackEntries.reduce((acc, entry) => {
    const key = entry.taskId.toString();
    if (!acc[key]) acc[key] = [];
    acc[key].push(entry);
    return acc;
  }, {});

  const currentUserId = req.user._id.toString();

  const payload = tasks.map((task) => {
    const obj = task.toObject();
    obj.adminFeedback = feedbackByTask[task._id.toString()] || [];
    obj.isPrimaryAssignee = task.assignedTo?.toString() === currentUserId;
    obj.userRoleInTask = obj.isPrimaryAssignee ? 'primary' : 'collaborator';
    const assigneesList = Array.isArray(obj.assignees) ? obj.assignees : [];
    obj.teamMembers = assigneesList.filter(
      (user) => user._id.toString() !== currentUserId
    );
    obj.assigneeCount = assigneesList.length;
    return obj;
  });

  res.json(payload);
});

router.post('/tasks/:id/start', [
  param('id').isMongoId().withMessage('معرف المهمة غير صالح'),
  body('message').optional().isString().trim()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const task = await ensureUserTask(req.params.id, req.user._id);
    if (!task) {
      return res.status(404).json({ message: 'المهمة غير موجودة أو غير مخصصة لك' });
    }
    if (task.status === 'completed') {
      return res.status(400).json({ message: 'المهمة مكتملة بالفعل' });
    }

    if (task.status !== 'in-progress') {
      task.status = 'in-progress';
      await task.save({ validateBeforeSave: false });
    }

    const progress = await TaskProgress.create({
      taskId: task._id,
      userId: req.user._id,
      type: 'started',
      message: req.body.message,
      statusSnapshot: task.status,
    });

    res.status(201).json({ task, progress });
  } catch (error) {
    console.error('Failed to register task start:', error);
    res.status(500).json({ message: 'حدث خطأ أثناء تسجيل بدء المهمة، يرجى المحاولة لاحقاً.' });
  }
});

router.post('/tasks/:id/request', upload.array('attachments', 5), [
  param('id').isMongoId().withMessage('معرف المهمة غير صالح'),
  body('message').isString().trim().notEmpty().withMessage('يجب كتابة تفاصيل الطلب')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const task = await ensureUserTask(req.params.id, req.user._id);
    if (!task) {
      return res.status(404).json({ message: 'المهمة غير موجودة أو غير مخصصة لك' });
    }

    if (task.status === 'pending') {
      task.status = 'in-progress';
      await task.save({ validateBeforeSave: false });
    }

    const attachments = (req.files || []).map((file) => ({
      filename: file.filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      url: `/uploads/${file.filename}`,
    }));

    const progress = await TaskProgress.create({
      taskId: task._id,
      userId: req.user._id,
      type: 'request',
      message: req.body.message,
      statusSnapshot: task.status,
      attachments,
    });

    res.status(201).json({ task, progress });
  } catch (error) {
    console.error('Failed to submit task request:', error);
    res.status(500).json({ message: 'حدث خطأ أثناء إرسال الطلب، يرجى المحاولة لاحقاً.' });
  }
});

router.post('/tasks/:id/complete', upload.array('attachments', 5), [
  param('id').isMongoId().withMessage('معرف المهمة غير صالح'),
  body('message').isString().trim().notEmpty().withMessage('يجب كتابة التقرير النهائي'),
  body('progress').optional().isInt({ min: 0, max: 100 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const task = await ensureUserTask(req.params.id, req.user._id);
    if (!task) {
      return res.status(404).json({ message: 'المهمة غير موجودة أو غير مخصصة لك' });
    }

    task.status = 'completed';
    await task.save({ validateBeforeSave: false });

    const attachments = (req.files || []).map((file) => ({
      filename: file.filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      url: `/uploads/${file.filename}`,
    }));

    const progress = await TaskProgress.create({
      taskId: task._id,
      userId: req.user._id,
      type: 'completed',
      message: req.body.message,
      statusSnapshot: task.status,
      metadata: {
        progress: req.body.progress ?? 100
      },
      attachments,
    });

    res.status(201).json({ task, progress });
  } catch (error) {
    console.error('Failed to complete task:', error);
    res.status(500).json({ message: 'حدث خطأ أثناء إنهاء المهمة، يرجى المحاولة لاحقاً.' });
  }
});

router.patch('/tasks/:id/details/:detailId', [
  param('id').isMongoId().withMessage('معرف المهمة غير صالح'),
  param('detailId').isMongoId().withMessage('معرف التفصيلة غير صالح'),
  body('isCompleted').optional().isBoolean().toBoolean(),
  body('note').optional().isString(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const task = await ensureUserTask(req.params.id, req.user._id);
    if (!task) {
      return res.status(404).json({ message: 'المهمة غير موجودة أو غير مخصصة لك' });
    }

    if (!Array.isArray(task.details) || task.details.length === 0) {
      return res.status(404).json({ message: 'لا تحتوي المهمة على تفاصيل لتحديثها' });
    }

    const detail = task.details.id(req.params.detailId);
    if (!detail) {
      return res.status(404).json({ message: 'تفصيلة المهمة غير موجودة' });
    }

    let hasChanges = false;

    if (req.body.isCompleted !== undefined) {
      detail.isCompleted = req.body.isCompleted;
      hasChanges = true;
    }

    if (req.body.note !== undefined) {
      detail.note = typeof req.body.note === 'string' ? req.body.note.trim() : '';
      hasChanges = true;
    }

    if (!hasChanges) {
      return res.status(400).json({ message: 'لم يتم إرسال بيانات لتحديثها' });
    }

    await task.save();

    const metadata = {
      detailId: detail._id,
      detailText: detail.text,
      isCompleted: detail.isCompleted,
    };

    if (detail.note) {
      metadata.note = detail.note;
    }

    await TaskProgress.create({
      taskId: task._id,
      userId: req.user._id,
      type: 'detail-update',
      message: req.body.note ? req.body.note.trim() : undefined,
      statusSnapshot: task.status,
      metadata,
    });

    const populatedTask = await Task.findOne({ _id: task._id })
      .populate('assignedBy', 'fullName username role')
      .populate('assignedTo', 'fullName username role')
      .populate('assignees', 'fullName username role');

    res.json(populatedTask);
  } catch (error) {
    console.error('Failed to update task detail:', error);
    res.status(500).json({ message: 'تعذر تحديث تفصيلة المهمة، يرجى المحاولة لاحقاً.' });
  }
});

export default router;