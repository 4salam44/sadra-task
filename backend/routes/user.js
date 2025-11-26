import express from 'express';
import Task from '../models/Task.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

router.get('/tasks', async (req, res) => {
  const tasks = await Task.find({ assignedTo: req.user._id })
    .populate('assignedBy', 'fullName')
    .sort({ priority: -1, dueDate: 1 });
  res.json(tasks);
});

export default router;