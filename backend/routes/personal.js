import express from 'express';
import PersonalTask from '../models/PersonalTask.js';
import PersonalTaskReport from '../models/PersonalTaskReport.js';
import { authenticate } from '../middleware/auth.js';
import { authorizePersonalTask } from '../middleware/personal.js';

const router = express.Router();
router.use(authenticate);

router.get('/tasks', async (req, res) => {
  const tasks = await PersonalTask.find({ userId: req.user._id })
    .sort({ createdAt: -1 });
  res.json(tasks);
});

router.post('/tasks', async (req, res) => {
  const task = await PersonalTask.create({ ...req.body, userId: req.user._id });
  res.json(task);
});

router.put('/tasks/:id', authorizePersonalTask, async (req, res) => {
  const task = await PersonalTask.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(task);
});

router.delete('/tasks/:id', authorizePersonalTask, async (req, res) => {
  await PersonalTask.findByIdAndDelete(req.params.id);
  await PersonalTaskReport.deleteMany({ personalTaskId: req.params.id });
  res.json({ success: true });
});

router.post('/tasks/:id/report-to-admin', authorizePersonalTask, async (req, res) => {
  const report = await PersonalTaskReport.create({
    ...req.body,
    personalTaskId: req.params.id,
    userId: req.user._id,
    sentToAdmin: true
  });
  await PersonalTask.findByIdAndUpdate(req.params.id, { isSharedWithAdmin: true });
  res.json(report);
});

export default router;