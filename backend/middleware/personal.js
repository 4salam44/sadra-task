import PersonalTask from '../models/PersonalTask.js';

export const loadPersonalTask = async (req, res, next) => {
  try {
    const task = await PersonalTask.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'المهمة غير موجودة' });
    }
    req.personalTask = task;
    return next();
  } catch (error) {
    return next(error);
  }
};

export const requirePersonalTaskOwner = (req, res, next) => {
  if (!req.personalTask) {
    return res.status(500).json({ message: 'لم يتم تحميل المهمة للتحقق من الصلاحية' });
  }

  const isOwner = req.personalTask.userId.toString() === req.user._id.toString();
  if (!isOwner) {
    return res.status(403).json({ message: 'ممنوع: مهمة شخصية خاصة بالمالك' });
  }

  return next();
};

export const requirePersonalTaskAccess = (req, res, next) => {
  if (!req.personalTask) {
    return res.status(500).json({ message: 'لم يتم تحميل المهمة للتحقق من الصلاحية' });
  }

  const currentUserId = req.user._id.toString();
  const isOwner = req.personalTask.userId.toString() === currentUserId;
  const isShared =
    Array.isArray(req.personalTask.sharedWith) &&
    req.personalTask.sharedWith.some((userId) => userId.toString() === currentUserId);

  if (!isOwner && !isShared) {
    return res.status(403).json({ message: 'ممنوع: المهمة غير متاحة لك' });
  }

  return next();
};