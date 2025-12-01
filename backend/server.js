import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import connectDB from './config/db.js';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import userRoutes from './routes/user.js';
import personalRoutes from './routes/personal.js';
import seedLocalData from './utils/seedLocalData.js';

dotenv.config();
const app = express();

const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim()).filter(Boolean)
  : null;

const corsOptions = {
  origin: corsOrigins && corsOrigins.length > 0 ? corsOrigins : true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/user', userRoutes);
app.use('/api/personal', personalRoutes);
app.use('/uploads', express.static(path.resolve('uploads'), {
  immutable: true,
  maxAge: '1d',
}));

const PORT = process.env.PORT || 10000;

const startServer = async () => {
  await connectDB();
  await seedLocalData();
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
};

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});