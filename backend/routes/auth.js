import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { body, validationResult } from 'express-validator';

const router = express.Router();

router.post('/login', [
  body('username').notEmpty(),
  body('password').notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { username, password } = req.body;
  const user = await User.findOne({ username, isActive: true });
  
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).send('بيانات الدخول غير صحيحة');
  }

  const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET);
  res.json({ token, user: { id: user._id, username, role: user.role, fullName: user.fullName } });
});

export default router;
// endpoint مؤقت لإنشاء الإدمن الأول (سيتم تعطيله لاحقاً)
router.post('/setup-first-admin', async (req, res) => {
  try {
    const exists = await User.findOne({ username: 'admin' });
    if (exists) return res.status(400).json({ message: 'Admin already exists' });

    const hashed = bcrypt.hashSync('admin123', 12);
    await User.create({
      fullName: 'مدير النظام',
      username: 'admin',
      password: hashed,
      role: 'admin',
      isActive: true
    });
    res.json({ message: '✅ تم إنشاء حساب الإدمن بنجاح' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});