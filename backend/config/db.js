import mongoose from 'mongoose';

const connectDB = async () => {
  const dbUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/santra1';

  if (!process.env.MONGODB_URI) {
    console.warn('[DB] Environment variable MONGODB_URI missing, using local fallback.');
  }

  try {
    await mongoose.connect(dbUri, {
      serverSelectionTimeoutMS: 5000,
    });
    const { name, host, port } = mongoose.connection;
    console.log(`[DB] MongoDB connected: ${name} @ ${host}:${port}`);
  } catch (error) {
    console.error('[DB] MongoDB connection error:', error.message);
    process.exit(1);
  }
};

export default connectDB;