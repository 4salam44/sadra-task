import express from 'express';
import User from '../models/User.js';
import Task from '../models/Task.js';
import PersonalTaskReport from '../models/PersonalTaskReport.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/admin.js';
import bcrypt from 'bcryptjs';
import { body } from 'express-validator';

const router = express.Router();
router.use(authenticate, requireAdmin);

router.post('/users', async (req, res) => {
  const hashedPassword = bcrypt.hashSync(req.body.password, 12);
  const user = await User.create({ ...req.body, password: hashedPassword });
  res.json(user);
});

router.get('/tasks', async (req, res) => {
  const tasks = await Task.find().populate('assignedTo assignedBy', 'fullName');
  res.json(tasks);
});

router.post('/tasks', async (req, res) => {
  const task = await Task.create({ ...req.body, assignedBy: req.user._id });
  res.json(task);
});

router.get('/personal-reports', async (req, res) => {
  const reports = await PersonalTaskReport.find({ sentToAdmin: true })
    .populate('userId', 'fullName')
    .populate('personalTaskId', 'title')
    .sort({ createdAt: -1 });
  res.json(reports);
});

export default router;