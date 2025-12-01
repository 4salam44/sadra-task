import express from 'express';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Task from '../models/Task.js';
import PersonalTask from '../models/PersonalTask.js';
import PersonalTaskReport from '../models/PersonalTaskReport.js';
import PersonalTaskLog from '../models/PersonalTaskLog.js';
import TaskProgress from '../models/TaskProgress.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/admin.js';
import { upload } from '../middleware/upload.js';
import bcrypt from 'bcryptjs';
import { body, validationResult, param } from 'express-validator';

const router = express.Router();
router.use(authenticate, requireAdmin);

const normalizeBoolean = (value) =>
  value === true || value === 'true' || value === 1 || value === '1';

const sanitizeTaskDetails = (details = []) =>
  details
    .slice(0, 25)
    .map((detail) => {
      if (!detail) return null;
      const text =
        typeof detail.text === 'string' ? detail.text.trim() : '';
      if (!text) return null;
      const payload = { text };

      if (detail.note !== undefined) {
        payload.note =
          typeof detail.note === 'string' ? detail.note.trim() : '';
      }

      if (detail.isCompleted !== undefined) {
        payload.isCompleted = normalizeBoolean(detail.isCompleted);
      }

      return payload;
    })
    .filter(Boolean);

const mapUploadedFiles = (files = []) =>
  (files || []).map((file) => ({
    filename: file.filename,
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
    url: `/uploads/${file.filename}`,
  }));

router.post('/users', async (req, res) => {
  const hashedPassword = bcrypt.hashSync(req.body.password, 12);
  const user = await User.create({ ...req.body, password: hashedPassword });
  const { password, ...userWithoutPassword } = user.toObject();
  res.json(userWithoutPassword);
});

router.get('/users', async (req, res) => {
  const users = await User.find().select('-password');
  res.json(users);
});

router.get('/tasks', async (req, res) => {
  const tasks = await Task.find()
    .populate('assignedTo assignedBy', 'fullName username role')
    .populate('assignees', 'fullName username role');
  res.json(tasks);
});

router.post('/tasks', [
  body('title').isString().trim().notEmpty(),
  body('priority').isInt({ min: 1, max: 3 }),
  body('assignedTo').isMongoId().withMessage('يجب تحديد مستخدم صالح للمهمة'),
  body('dueDate').optional().isISO8601().toDate(),
  body('description').optional().isString(),
  body('assignees').optional().isArray().withMessage('قائمة المشاركين يجب أن تكون مصفوفة'),
  body('assignees.*').optional().isMongoId().withMessage('معرف مستخدم غير صالح في قائمة المشاركين'),
  body('details').optional().isArray().withMessage('تفاصيل المهمة يجب أن تكون في شكل قائمة'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const assignedUser = await User.findOne({ _id: req.body.assignedTo, isActive: true });
  if (!assignedUser) {
    return res.status(400).json({ message: 'المستخدم المحدد غير متاح أو غير فعّال' });
  }

  const collaborators = Array.isArray(req.body.assignees) ? req.body.assignees : [];
  const uniqueAssigneesStrings = Array.from(
    new Set([
      ...collaborators.map((id) => id?.toString()).filter(Boolean),
      req.body.assignedTo.toString(),
    ])
  );

  let assigneeObjectIds;
  try {
    assigneeObjectIds = uniqueAssigneesStrings.map((id) => {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new Error(`invalid-id:${id}`);
      }
      return new mongoose.Types.ObjectId(id);
    });
  } catch (conversionError) {
    return res.status(400).json({ message: 'قائمة المشاركين تحتوي على معرف مستخدم غير صالح.' });
  }

  const activeAssignees = await User.find({
    _id: { $in: assigneeObjectIds },
    isActive: true,
  }).select('_id');

  if (activeAssignees.length !== assigneeObjectIds.length) {
    return res.status(400).json({ message: 'بعض المستخدمين المشاركين غير متاحين أو غير مفعّلين' });
  }

  const detailPayload = Array.isArray(req.body.details)
    ? sanitizeTaskDetails(req.body.details)
    : [];

  try {
    const task = await Task.create({
      title: req.body.title,
      description: req.body.description,
      priority: req.body.priority,
      assignedTo: req.body.assignedTo,
      assignees: assigneeObjectIds,
      dueDate: req.body.dueDate,
      assignedBy: req.user._id,
      details: detailPayload,
    });

    const populatedTask = await task.populate([
      { path: 'assignedTo', select: 'fullName username role' },
      { path: 'assignedBy', select: 'fullName username role' },
      { path: 'assignees', select: 'fullName username role' },
    ]);
    res.status(201).json(populatedTask);
  } catch (err) {
    console.error('[admin] Failed to create task', err);
    res.status(500).json({
      message: 'حدث خطأ أثناء إنشاء المهمة، يرجى المحاولة مجدداً.',
      details: err.message,
    });
  }
});

router.delete('/tasks/:id', async (req, res) => {
  const task = await Task.findByIdAndDelete(req.params.id);
  if (!task) return res.status(404).json({ message: 'المهمة غير موجودة' });
  res.json({ success: true });
});

router.patch(
  '/tasks/:id/details/:detailId',
  [
    param('id').isMongoId().withMessage('معرف المهمة غير صالح'),
    param('detailId').isMongoId().withMessage('معرف التفصيلة غير صالح'),
    body('text').optional().isString().trim().notEmpty().withMessage('نص التفصيلة لا يمكن أن يكون فارغاً'),
    body('note').optional().isString(),
    body('isCompleted').optional().isBoolean().toBoolean(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const task = await Task.findById(req.params.id);
      if (!task) {
        return res.status(404).json({ message: 'المهمة غير موجودة' });
      }

      const detail = task.details.id(req.params.detailId);
      if (!detail) {
        return res.status(404).json({ message: 'تفصيلة المهمة غير موجودة' });
      }

      if (req.body.text !== undefined) {
        detail.text = req.body.text.trim();
      }

      if (req.body.note !== undefined) {
        detail.note = typeof req.body.note === 'string' ? req.body.note.trim() : '';
      }

      if (req.body.isCompleted !== undefined) {
        detail.isCompleted = req.body.isCompleted;
      }

      await task.save();

      const populatedTask = await task.populate([
        { path: 'assignedTo', select: 'fullName username role' },
        { path: 'assignedBy', select: 'fullName username role' },
        { path: 'assignees', select: 'fullName username role' },
      ]);

      res.json(populatedTask);
    } catch (error) {
      console.error('[admin] Failed to update task detail', error);
      res.status(500).json({
        message: 'تعذر تحديث تفصيلة المهمة',
        details: error.message,
      });
    }
  }
);

router.get('/personal-tasks', async (req, res) => {
  try {
    const tasks = await PersonalTask.find({
      $or: [{ isSharedWithAdmin: true }, { sharedWith: req.user._id }],
    })
      .populate('userId', 'fullName username role')
      .populate('sharedWith', 'fullName username role')
      .sort({ updatedAt: -1, createdAt: -1 });

    res.json(tasks);
  } catch (error) {
    console.error('[admin] Failed to load personal tasks', error);
    res.status(500).json({
      message: 'تعذر تحميل المهام الشخصية المشاركة',
      details: error.message,
    });
  }
});

router.get('/personal-logs', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const query = { isSharedWithAdmin: true };

    if (req.query.userId && mongoose.Types.ObjectId.isValid(req.query.userId)) {
      query.userId = req.query.userId;
    }

    if (req.query.taskId && mongoose.Types.ObjectId.isValid(req.query.taskId)) {
      query.personalTaskId = req.query.taskId;
    }

    const logs = await PersonalTaskLog.find(query)
      .sort({ sharedAt: -1, createdAt: -1 })
      .limit(limit)
      .populate('personalTaskId', 'title category')
      .populate('userId', 'fullName username role');

    res.json(logs);
  } catch (error) {
    console.error('[admin] Failed to load shared personal logs', error);
    res.status(500).json({
      message: 'تعذر تحميل التقارير الشخصية المشتركة',
      details: error.message,
    });
  }
});

router.get('/personal-reports', async (req, res) => {
  const reports = await PersonalTaskReport.find({ sentToAdmin: true })
    .populate('userId', 'fullName username role')
    .populate('personalTaskId', 'title category')
    .sort({ createdAt: -1 });
  res.json(reports);
});

router.post(
  '/personal-reports/:id/respond',
  upload.array('attachments', 5),
  [
    param('id').isMongoId().withMessage('معرف التقرير غير صالح'),
    body('message').optional().isString().trim(),
    body('status')
      .optional()
      .isIn(['needs-info', 'resolved'])
      .withMessage('حالة التقرير غير صالحة'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const report = await PersonalTaskReport.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ message: 'التقرير الشخصي غير موجود' });
    }

    const message =
      typeof req.body.message === 'string' && req.body.message.trim()
        ? req.body.message.trim()
        : undefined;
    const attachments = mapUploadedFiles(req.files);

    if (!message && attachments.length === 0) {
      return res
        .status(400)
        .json({ message: 'يرجى كتابة رسالة أو إرفاق ملف على الأقل' });
    }

    report.conversations.push({
      authorRole: 'admin',
      message,
      attachments,
    });

    if (attachments.length) {
      report.attachments.push(...attachments);
    }

    if (req.body.status) {
      report.status = req.body.status;
    }

    report.adminViewed = true;
    report.lastAdminResponseAt = new Date();

    await report.save();

    const populated = await PersonalTaskReport.findById(report._id)
      .populate('userId', 'fullName username role')
      .populate('personalTaskId', 'title category');

    res.json(populated);
  }
);

router.get('/reports', async (req, res) => {
  const reports = await Task.find({ status: { $in: ['completed', 'late'] } })
    .populate('assignedTo assignedBy', 'fullName username role')
    .populate('assignees', 'fullName username role')
    .sort({ updatedAt: -1 });
  res.json(reports);
});

router.get('/tasks/:id/progress', [
  param('id').isMongoId().withMessage('معرف المهمة غير صالح')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const progress = await TaskProgress.find({ taskId: req.params.id })
    .populate('userId', 'fullName username')
    .sort({ createdAt: -1 });

  res.json(progress);
});

router.get('/task-progress', async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 200);
  const progress = await TaskProgress.find({})
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('taskId', 'title status assignedTo assignees')
    .populate('userId', 'fullName username');

  res.json(progress);
});

router.post('/tasks/:id/respond', upload.array('attachments', 5), [
  param('id').isMongoId().withMessage('معرف المهمة غير صالح'),
  body('message').isString().trim().notEmpty().withMessage('يرجى كتابة الرد للعضو'),
  body('referenceId').optional().isMongoId()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const task = await Task.findById(req.params.id);
  if (!task) {
    return res.status(404).json({ message: 'المهمة غير موجودة' });
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
    type: 'admin-response',
    message: req.body.message,
    statusSnapshot: task.status,
    metadata: {
      action: 'response',
      referenceId: req.body.referenceId || null,
    },
    attachments,
  });

  res.status(201).json({ task, progress });
});

router.post('/tasks/:id/accept', upload.array('attachments', 5), [
  param('id').isMongoId().withMessage('معرف المهمة غير صالح'),
  body('message').optional().isString().trim(),
  body('referenceId').optional().isMongoId()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const task = await Task.findById(req.params.id);
  if (!task) {
    return res.status(404).json({ message: 'المهمة غير موجودة' });
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
    type: 'admin-response',
    message: req.body.message?.length ? req.body.message : 'تم قبول المهمة. شكرًا على جهودك.',
    statusSnapshot: task.status,
    metadata: {
      action: 'accept',
      referenceId: req.body.referenceId || null,
    },
    attachments,
  });

  res.json({ task, progress });
});

router.post('/tasks/:id/return', upload.array('attachments', 5), [
  param('id').isMongoId().withMessage('معرف المهمة غير صالح'),
  body('message').isString().trim().notEmpty().withMessage('يرجى كتابة متطلبات الإكمال للمستخدم'),
  body('referenceId').optional().isMongoId()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const task = await Task.findById(req.params.id);
  if (!task) {
    return res.status(404).json({ message: 'المهمة غير موجودة' });
  }

  task.status = 'returned';
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
    type: 'returned',
    message: req.body.message,
    statusSnapshot: task.status,
    metadata: {
      action: 'return',
      referenceId: req.body.referenceId || null,
    },
    attachments,
  });

  res.json({ task, progress });
});

router.put('/users/:id', [
  body('fullName').optional().isString().trim().notEmpty(),
  body('username').optional().isString().trim().notEmpty(),
  body('password').optional().isLength({ min: 6 }),
  body('role').optional().isIn(['admin', 'user']),
  body('isActive').optional().isBoolean()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const updates = { ...req.body };
  if (updates.password) {
    updates.password = bcrypt.hashSync(updates.password, 12);
  }

  const user = await User.findByIdAndUpdate(
    req.params.id,
    updates,
    { new: true, runValidators: true }
  ).select('-password');

  if (!user) return res.status(404).json({ message: 'المستخدم غير موجود' });

  res.json(user);
});

export default router;