import PersonalTask from '../models/PersonalTask.js';

export const authorizePersonalTask = async (req, res, next) => {
  const task = await PersonalTask.findById(req.params.id);
  if (!task) return res.status(404).send('المهمة غير موجودة');
  if (task.userId.toString() !== req.user.id) {
    return res.status(403).send('ممنوع: مهمة شخصية خاصة');
  }
  next();
};