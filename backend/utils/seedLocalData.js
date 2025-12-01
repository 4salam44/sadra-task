import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Task from '../models/Task.js';
import PersonalTask from '../models/PersonalTask.js';

const isLocalUri = (uri) => {
  if (!uri) return true;
  return uri.includes('127.0.0.1') || uri.includes('localhost');
};

const shouldSeed = () => {
  if (process.env.NODE_ENV === 'production') return false;
  if (process.env.SEED_LOCAL_DATA === 'false') return false;
  if (!isLocalUri(process.env.MONGODB_URI)) {
    console.warn('[seed] Skipping local seed because MONGODB_URI is not local. Set SEED_LOCAL_DATA=true explicitly to override.');
    return false;
  }
  return true;
};

const ensureUser = async ({ username, password, ...rest }) => {
  let user = await User.findOne({ username });
  if (user) return user;

  const hashedPassword = bcrypt.hashSync(password, 12);
  try {
    user = await User.create({
      username,
      password: hashedPassword,
      ...rest,
    });
    console.log(`[seed] Created user "${username}" with temporary password.`);
    return user;
  } catch (err) {
    if (err.code === 11000) {
      console.warn(`[seed] User "${username}" already exists (duplicate key). Using existing record.`);
      return User.findOne({ username });
    }
    throw err;
  }
};

const seedLocalData = async () => {
  if (!shouldSeed()) {
    return;
  }

  const admin = await ensureUser({
    username: 'admin',
    password: 'admin123',
    fullName: 'مدير النظام',
    role: 'admin',
    isActive: true,
  });

  const standardUser = await ensureUser({
    username: 'user1',
    password: 'user123',
    fullName: 'مستخدم افتراضي',
    role: 'user',
    isActive: true,
  });

  const tasksCount = await Task.countDocuments();
  if (tasksCount === 0) {
    await Task.create([
      {
        title: 'إعداد تقرير أسبوعي',
        description: 'إنشاء تقرير مفصل عن التقدم الأسبوعي للمشروع.',
        priority: 3,
        status: 'pending',
        assignedTo: standardUser._id,
        assignees: [standardUser._id],
        assignedBy: admin._id,
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      },
      {
        title: 'مراجعة واجهات المستخدم',
        description: 'تحسين واجهة تسجيل الدخول وإصلاح الأخطاء الظاهرة.',
        priority: 2,
        status: 'pending',
        assignedTo: standardUser._id,
        assignees: [standardUser._id],
        assignedBy: admin._id,
        dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      },
    ]);
    console.log('[seed] Created sample assigned tasks.');
  }

  const personalTaskCount = await PersonalTask.countDocuments({ userId: standardUser._id });
  if (personalTaskCount === 0) {
    await PersonalTask.create([
      {
        userId: standardUser._id,
        title: 'قراءة مستندات المشروع',
        description: 'قراءة وتحضير ملخص للمستندات الداخلية.',
        category: 'تعلم',
        priority: 2,
        status: 'in-progress',
      },
      {
        userId: standardUser._id,
        title: 'تنظيم مساحة العمل',
        description: 'إعادة ترتيب الأدوات وتحسين بيئة العمل.',
        category: 'تنظيم',
        priority: 1,
        status: 'pending',
      },
    ]);
    console.log('[seed] Created sample personal tasks.');
  }

  console.log('[seed] Local data ready. Admin login: admin/admin123, User login: user1/user123');
};

export default seedLocalData;

