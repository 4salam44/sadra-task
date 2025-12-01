import express from 'express';
import mongoose from 'mongoose';
import PersonalTask from '../models/PersonalTask.js';
import PersonalTaskReport from '../models/PersonalTaskReport.js';
import PersonalTaskLog from '../models/PersonalTaskLog.js';
import User from '../models/User.js';
import { authenticate } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import {
  loadPersonalTask,
  requirePersonalTaskAccess,
  requirePersonalTaskOwner,
} from '../middleware/personal.js';

const router = express.Router();
router.use(authenticate);

const idsEqual = (a, b) => {
  if (!a || !b) return false;
  return a.toString() === b.toString();
};

const parseDate = (value) => {
  if (value === null || value === '') return null;
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const sanitizeDetails = (details = []) =>
  details
    .map((detail) => {
      if (!detail) return null;
      const text =
        typeof detail.text === 'string' ? detail.text.trim() : '';
      if (!text) return null;
      const isCompleted =
        detail.isCompleted === true ||
        detail.isCompleted === 'true' ||
        detail.isCompleted === 1 ||
        detail.isCompleted === '1';
      const note =
        typeof detail.note === 'string' ? detail.note.trim() : undefined;

      const detailPayload = {
        text,
        isCompleted,
      };

      if (note !== undefined) {
        detailPayload.note = note;
      }

      const detailId =
        typeof detail._id === 'string'
          ? detail._id.trim()
          : detail._id?._id?.toString();
      if (detailId && mongoose.Types.ObjectId.isValid(detailId)) {
        detailPayload._id = detailId;
      }

      return detailPayload;
    })
    .filter(Boolean);

const buildTaskPayload = (body, { allowShared = false } = {}) => {
  const payload = {};

  if (typeof body.title === 'string') {
    payload.title = body.title.trim();
  }

  if (Object.prototype.hasOwnProperty.call(body, 'description')) {
    payload.description =
      typeof body.description === 'string'
        ? body.description.trim()
        : '';
  }

  if (Object.prototype.hasOwnProperty.call(body, 'category')) {
    payload.category =
      typeof body.category === 'string' ? body.category.trim() : '';
  }

  if (body.priority !== undefined) {
    const priority = Number(body.priority);
    if ([1, 2, 3].includes(priority)) {
      payload.priority = priority;
    }
  }

  if (body.status !== undefined) {
    const allowedStatuses = ['pending', 'in-progress', 'completed'];
    if (allowedStatuses.includes(body.status)) {
      payload.status = body.status;
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, 'dueDate')) {
    const parsed = parseDate(body.dueDate);
    if (parsed === null) {
      payload.dueDate = null;
    } else if (parsed instanceof Date) {
      payload.dueDate = parsed;
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, 'reminderAt')) {
    const parsed = parseDate(body.reminderAt);
    if (parsed === null) {
      payload.reminderAt = null;
    } else if (parsed instanceof Date) {
      payload.reminderAt = parsed;
    }
  }

  if (Array.isArray(body.details)) {
    payload.details = sanitizeDetails(body.details);
  }

  if (Object.prototype.hasOwnProperty.call(body, 'timerConfig')) {
    const timer = body.timerConfig;
    if (timer === null) {
      payload.timerConfig = null;
    } else if (typeof timer === 'object' && timer !== undefined) {
      const timerPayload = {};
      if (Object.prototype.hasOwnProperty.call(timer, 'label')) {
        timerPayload.label =
          typeof timer.label === 'string' ? timer.label.trim() : '';
      }
      if (timer.durationMinutes !== undefined) {
        const duration = Number(timer.durationMinutes);
        if (!Number.isNaN(duration) && duration > 0) {
          timerPayload.durationMinutes = duration;
        }
      }
      if (timer.autoStart !== undefined) {
        timerPayload.autoStart = Boolean(timer.autoStart);
      }
      if (Object.keys(timerPayload).length > 0) {
        payload.timerConfig = timerPayload;
      }
    }
  }

  if (allowShared) {
    if (Array.isArray(body.sharedWithUserIds)) {
      payload.sharedWithUserIds = body.sharedWithUserIds;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'allowSharedEdit')) {
      payload.allowSharedEdit = Boolean(body.allowSharedEdit);
    }
  }

  return payload;
};

const resolveSharedUsers = async (candidateIds = [], currentUserId) => {
  const normalized = candidateIds
    .map((candidate) => {
      if (!candidate) return null;
      if (typeof candidate === 'string') return candidate.trim();
      if (candidate._id) return candidate._id.toString();
      return candidate.toString();
    })
    .filter(Boolean)
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => id.toString())
    .filter((id) => id !== currentUserId.toString());

  if (!normalized.length) return [];

  const uniqueIds = [...new Set(normalized)].map(
    (id) => new mongoose.Types.ObjectId(id)
  );

  const activeUsers = await User.find({
    _id: { $in: uniqueIds },
    isActive: true,
  }).select('_id');

  return activeUsers.map((user) => user._id);
};

const formatPersonalTaskForUser = (taskDoc, currentUserId) => {
  if (!taskDoc) return null;

  const obj =
    typeof taskDoc.toObject === 'function'
      ? taskDoc.toObject({ depopulate: false })
      : { ...taskDoc };

  const currentId = currentUserId?.toString?.() || currentUserId?.toString();

  const resolveId = (value) => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (value instanceof mongoose.Types.ObjectId) return value.toString();
    if (value._id) return value._id.toString();
    return '';
  };

  const ownerId = resolveId(obj.userId);
  const sharedIds = Array.isArray(obj.sharedWith)
    ? obj.sharedWith.map((entry) => resolveId(entry))
    : [];

  obj.isOwner = ownerId === currentId;
  obj.isSharedWithCurrentUser = !obj.isOwner && sharedIds.includes(currentId);
  if (!Array.isArray(obj.sharedWith)) {
    obj.sharedWith = [];
  }
  if (!obj.reportSummary) {
    obj.reportSummary = {
      totalMinutes: 0,
      lastLogAt: null,
      sharedLogCount: 0,
    };
  }

  return obj;
};

const fetchTaskWithRelations = async (taskId, currentUserId) => {
  const doc = await PersonalTask.findById(taskId)
    .populate('sharedWith', 'fullName username role')
    .populate('userId', 'fullName username role');
  if (!doc) return null;
  return formatPersonalTaskForUser(doc, currentUserId);
};

const mapUploadedFiles = (files = []) =>
  (files || []).map((file) => ({
    filename: file.filename,
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
    url: `/uploads/${file.filename}`,
  }));

const bumpTaskSummary = async (taskId, { durationMinutes = 0, logDate, sharedDelta = 0 } = {}) => {
  const update = {};
  if (durationMinutes) {
    update.$inc = {
      ...(update.$inc || {}),
      'reportSummary.totalMinutes': durationMinutes,
    };
  }
  if (logDate) {
    update.$max = {
      ...(update.$max || {}),
      'reportSummary.lastLogAt': logDate,
    };
  }
  if (sharedDelta) {
    update.$inc = {
      ...(update.$inc || {}),
      'reportSummary.sharedLogCount': sharedDelta,
    };
  }

  if (Object.keys(update).length === 0) {
    return;
  }

  await PersonalTask.findByIdAndUpdate(taskId, update, {
    new: false,
    lean: true,
  });
};

router.get('/tasks', async (req, res, next) => {
  try {
    const tasks = await PersonalTask.find({
      $or: [{ userId: req.user._id }, { sharedWith: req.user._id }],
    })
      .populate('sharedWith', 'fullName username role')
      .populate('userId', 'fullName username role')
      .sort({ updatedAt: -1, createdAt: -1 });

    const formatted = tasks
      .map((task) => formatPersonalTaskForUser(task, req.user._id))
      .filter(Boolean);

    res.json(formatted);
  } catch (error) {
    next(error);
  }
});

router.get('/collaborators', async (req, res, next) => {
  try {
    const query = (req.query.q || '').toString().trim();
    if (!query) {
      return res.json([]);
    }
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');

    const users = await User.find({
      _id: { $ne: req.user._id },
      isActive: true,
      $or: [{ username: regex }, { fullName: regex }],
    })
      .select('_id fullName username role')
      .sort({ fullName: 1 })
      .limit(10);

    res.json(users);
  } catch (error) {
    next(error);
  }
});

router.post('/tasks', async (req, res, next) => {
  try {
    const payload = buildTaskPayload(req.body, { allowShared: true });
    payload.userId = req.user._id;

    if (payload.sharedWithUserIds) {
      payload.sharedWith = await resolveSharedUsers(
        payload.sharedWithUserIds,
        req.user._id
      );
      delete payload.sharedWithUserIds;
    }

    const task = await PersonalTask.create(payload);
    const populatedTask = await fetchTaskWithRelations(task._id, req.user._id);
    res.json(populatedTask);
  } catch (error) {
    next(error);
  }
});

router.put(
  '/tasks/:id',
  loadPersonalTask,
  requirePersonalTaskOwner,
  async (req, res, next) => {
    try {
      const payload = buildTaskPayload(req.body, { allowShared: true });

      if (payload.sharedWithUserIds) {
        payload.sharedWith = await resolveSharedUsers(
          payload.sharedWithUserIds,
          req.user._id
        );
        delete payload.sharedWithUserIds;
      }

      const updatedTask = await PersonalTask.findByIdAndUpdate(
        req.params.id,
        payload,
        { new: true, runValidators: true }
      );

      const populatedTask = await fetchTaskWithRelations(updatedTask._id, req.user._id);
      res.json(populatedTask);
    } catch (error) {
      next(error);
    }
  }
);

router.delete(
  '/tasks/:id',
  loadPersonalTask,
  requirePersonalTaskOwner,
  async (req, res, next) => {
    try {
      await PersonalTask.findByIdAndDelete(req.params.id);
      await PersonalTaskReport.deleteMany({ personalTaskId: req.params.id });
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

router.patch(
  '/tasks/:id/details/:detailId',
  loadPersonalTask,
  requirePersonalTaskAccess,
  async (req, res, next) => {
    try {
      const { detailId } = req.params;
      const { isCompleted, note, text } = req.body || {};
      const task = req.personalTask;
      const detail = task.details.id(detailId);
      if (!detail) {
        return res.status(404).json({ message: 'تفصيلة المهمة غير موجودة' });
      }

      const isOwner = idsEqual(task.userId, req.user._id);
      if (!isOwner && !task.allowSharedEdit) {
        return res.status(403).json({
          message: 'لا تملك صلاحية تعديل تفاصيل هذه المهمة',
        });
      }

      if (text !== undefined && typeof text === 'string') {
        detail.text = text.trim();
      }
      if (note !== undefined) {
        detail.note = typeof note === 'string' ? note.trim() : '';
      }
      if (isCompleted !== undefined) {
        detail.isCompleted =
          isCompleted === true ||
          isCompleted === 'true' ||
          isCompleted === 1 ||
          isCompleted === '1';
      }

      await task.save();
      const populatedTask = await fetchTaskWithRelations(task._id, req.user._id);
      res.json(populatedTask);
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/tasks/:id/logs',
  loadPersonalTask,
  requirePersonalTaskAccess,
  async (req, res, next) => {
    try {
      const task = req.personalTask;
      const filter = {
        personalTaskId: task._id,
      };

      const isOwner = idsEqual(task.userId, req.user._id);
      if (!isOwner) {
        filter.$or = [
          { isSharedWithAdmin: true },
          { userId: req.user._id },
        ];
      }

      const logs = await PersonalTaskLog.find(filter)
        .sort({ createdAt: -1 });

      res.json(logs);
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/tasks/:id/logs',
  loadPersonalTask,
  requirePersonalTaskOwner,
  async (req, res, next) => {
    try {
      const { type, title, description, startedAt, endedAt, durationMinutes, progress, metadata } =
        req.body || {};

      const startCandidate = parseDate(startedAt);
      const parsedStart = startCandidate instanceof Date ? startCandidate : new Date();
      const endCandidate = parseDate(endedAt);
      const parsedEnd = endCandidate instanceof Date ? endCandidate : undefined;

      let computedDuration = 0;
      if (
        durationMinutes !== undefined &&
        !Number.isNaN(Number(durationMinutes)) &&
        Number(durationMinutes) >= 0
      ) {
        computedDuration = Math.round(Number(durationMinutes));
      } else if (parsedEnd instanceof Date) {
        const diff = parsedEnd.getTime() - parsedStart.getTime();
        if (Number.isFinite(diff) && diff > 0) {
          computedDuration = Math.round(diff / 60000);
        }
      }

      const clampedProgress =
        progress === undefined
          ? undefined
          : Math.min(100, Math.max(0, Number(progress)));

      const log = await PersonalTaskLog.create({
        personalTaskId: req.personalTask._id,
        userId: req.user._id,
        type: ['session', 'note', 'milestone', 'detail-update'].includes(type)
          ? type
          : 'note',
        title: typeof title === 'string' && title.trim() ? title.trim() : undefined,
        description:
          typeof description === 'string' && description.trim()
            ? description.trim()
            : undefined,
        startedAt: parsedStart,
        endedAt: parsedEnd,
        durationMinutes: computedDuration,
        progress:
          clampedProgress === undefined || Number.isNaN(clampedProgress)
            ? undefined
            : clampedProgress,
        metadata:
          metadata && typeof metadata === 'object' ? metadata : undefined,
      });

      await bumpTaskSummary(req.personalTask._id, {
        durationMinutes: computedDuration,
        logDate: log.startedAt || log.createdAt,
      });

      res.status(201).json(log);
    } catch (error) {
      next(error);
    }
  }
);

router.patch(
  '/tasks/:id/logs/:logId',
  loadPersonalTask,
  requirePersonalTaskOwner,
  async (req, res, next) => {
    try {
      const log = await PersonalTaskLog.findOne({
        _id: req.params.logId,
        personalTaskId: req.personalTask._id,
        userId: req.user._id,
      });

      if (!log) {
        return res.status(404).json({ message: 'التحديث الشخصي غير موجود' });
      }

      const originalDuration = log.durationMinutes || 0;

      const { type, title, description, startedAt, endedAt, durationMinutes, progress, metadata } =
        req.body || {};

      if (type && ['session', 'note', 'milestone', 'detail-update'].includes(type)) {
        log.type = type;
      }

      if (title !== undefined) {
        log.title = typeof title === 'string' && title.trim() ? title.trim() : undefined;
      }

      if (description !== undefined) {
        log.description =
          typeof description === 'string' && description.trim()
            ? description.trim()
            : undefined;
      }

      let parsedStart;
      if (startedAt !== undefined) {
        const parsed = parseDate(startedAt);
        if (parsed instanceof Date) {
          parsedStart = parsed;
          log.startedAt = parsed;
        }
      }

      let parsedEnd;
      if (endedAt !== undefined) {
        const parsed = parseDate(endedAt);
        if (parsed === null) {
          log.endedAt = undefined;
        } else if (parsed instanceof Date) {
          parsedEnd = parsed;
          log.endedAt = parsed;
        }
      }

      let durationOverridden = false;
      if (durationMinutes !== undefined && !Number.isNaN(Number(durationMinutes))) {
        const value = Math.max(0, Math.round(Number(durationMinutes)));
        log.durationMinutes = value;
        durationOverridden = true;
      }

      if (progress !== undefined && !Number.isNaN(Number(progress))) {
        const clamped = Math.min(100, Math.max(0, Number(progress)));
        log.progress = clamped;
      }

      if (metadata !== undefined && typeof metadata === 'object') {
        log.metadata = metadata;
      }

      if (!durationOverridden) {
        const effectiveStart = parsedStart || log.startedAt;
        const effectiveEnd = parsedEnd || log.endedAt;
        if (effectiveStart && effectiveEnd) {
          const diff = effectiveEnd.getTime() - effectiveStart.getTime();
          log.durationMinutes = diff > 0 ? Math.round(diff / 60000) : 0;
        }
      }

      await log.save();

      const durationDelta = (log.durationMinutes || 0) - originalDuration;

      await bumpTaskSummary(req.personalTask._id, {
        durationMinutes: durationDelta,
        logDate: log.startedAt || log.createdAt,
      });

      res.json(log);
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/tasks/:id/logs/:logId/share',
  loadPersonalTask,
  requirePersonalTaskOwner,
  async (req, res, next) => {
    try {
      const log = await PersonalTaskLog.findOne({
        _id: req.params.logId,
        personalTaskId: req.personalTask._id,
        userId: req.user._id,
      });

      if (!log) {
        return res.status(404).json({ message: 'التحديث الشخصي غير موجود' });
      }

      if (!log.isSharedWithAdmin) {
        log.isSharedWithAdmin = true;
        log.sharedAt = new Date();
        await log.save();

        await bumpTaskSummary(req.personalTask._id, { sharedDelta: 1 });

        if (!req.personalTask.isSharedWithAdmin) {
          await PersonalTask.findByIdAndUpdate(req.personalTask._id, {
            $set: { isSharedWithAdmin: true },
          });
        }
      }

      res.json(log);
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/tasks/:id/report-to-admin',
  loadPersonalTask,
  requirePersonalTaskOwner,
  upload.array('attachments', 5),
  async (req, res, next) => {
    try {
      const completion =
        req.body.completionPercentage !== undefined
          ? Number(req.body.completionPercentage)
          : undefined;
      const notes =
        typeof req.body.notes === 'string' && req.body.notes.trim()
          ? req.body.notes.trim()
          : undefined;

      const attachments = mapUploadedFiles(req.files);

      const now = new Date();
      const report = await PersonalTaskReport.create({
        personalTaskId: req.params.id,
        userId: req.user._id,
        completionPercentage:
          completion !== undefined && !Number.isNaN(completion) ? completion : undefined,
        notes,
        attachments,
        sentToAdmin: true,
        adminViewed: false,
        status: 'submitted',
        conversations:
          (notes || attachments.length) > 0
            ? [
                {
                  authorRole: 'user',
                  message: notes,
                  attachments,
                  createdAt: now,
                },
              ]
            : [],
        lastUserResponseAt: now,
      });

      if (!req.personalTask.isSharedWithAdmin) {
        req.personalTask.isSharedWithAdmin = true;
        await req.personalTask.save({ validateBeforeSave: false });
      }

      const populated = await PersonalTaskReport.findById(report._id)
        .populate('personalTaskId', 'title category')
        .populate('userId', 'fullName username');

      res.status(201).json(populated);
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/reports/:id/respond',
  upload.array('attachments', 5),
  async (req, res, next) => {
    try {
      const report = await PersonalTaskReport.findById(req.params.id);
      if (!report) {
        return res.status(404).json({ message: 'التقرير غير موجود' });
      }
      if (report.userId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'لا تملك صلاحية تحديث هذا التقرير' });
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
        authorRole: 'user',
        message,
        attachments,
      });
      if (attachments.length) {
        report.attachments.push(...attachments);
      }
      report.status = 'submitted';
      report.adminViewed = false;
      report.lastUserResponseAt = new Date();

      await report.save();

      const populated = await PersonalTaskReport.findById(report._id)
        .populate('personalTaskId', 'title category')
        .populate('userId', 'fullName username');

      res.json(populated);
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/tasks/:id/reports',
  loadPersonalTask,
  requirePersonalTaskOwner,
  async (req, res, next) => {
    try {
      const reports = await PersonalTaskReport.find({
        personalTaskId: req.params.id,
        userId: req.user._id,
      })
        .populate('personalTaskId', 'title')
        .sort({ createdAt: -1 });

      res.json(reports);
    } catch (error) {
      next(error);
    }
  }
);

export default router;