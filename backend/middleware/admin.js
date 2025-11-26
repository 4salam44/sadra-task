export const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).send('ممنوع: يتطلب صلاحيات إدمن');
  }
  next();
};