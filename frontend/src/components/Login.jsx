import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import santraLogo from '@brand/santra.svg';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const { data } = await axios.post('/auth/login', { username, password });
      login(data);
      if (data.user.role === 'admin') navigate('/admin/tasks');
      else navigate('/dashboard');
    } catch (err) {
      alert('خطأ في الدخول');
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-brand-primary/15 via-brand-soft/30 to-white">
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-20">
        <img
          src={santraLogo}
          alt="شعار Santra Task (خلفية)"
          className="w-[min(85vw,720px)] max-w-3xl"
          aria-hidden="true"
        />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col justify-center px-6 py-12 lg:flex-row lg:items-center lg:gap-16">
        <section className="hidden w-full max-w-xl flex-col gap-6 rounded-3xl border border-brand-muted/50 bg-white/70 p-10 shadow-soft backdrop-blur lg:flex">
          <div className="flex items-center gap-5">
            <img src={santraLogo} alt="شعار Santra Task" className="h-24 w-auto drop-shadow-[0_25px_45px_rgba(32,94,168,0.35)]" />
            <span className="rounded-full bg-brand-primary/10 px-4 py-1 text-sm font-medium text-brand-primary">
              منصة Santra Task
            </span>
          </div>
          <h2 className="font-display text-4xl font-semibold leading-snug text-brand-ink">
            إدارة متكاملة للمهام
          </h2>
          <p className="text-base leading-relaxed text-brand-ink/70">
            أنجز المهام الشخصية ومهام الفريق بسهولة، راقب تقدمك، وتواصل مع الإدارة مباشرةً من مكان واحد.
          </p>
          <div className="grid gap-3 text-sm text-brand-ink/70">
            <div className="rounded-2xl border border-brand-primary/30 bg-brand-primary/10 px-4 py-3">
              تتبّع لحظي للتقارير الشخصية والمهام المشتركة.
            </div>
            <div className="rounded-2xl border border-brand-secondary/30 bg-brand-secondary/10 px-4 py-3">
              دعم المرفقات، طلبات التوضيح، وسجل كامل للمحادثات.
            </div>
            <div className="rounded-2xl border border-brand-muted/60 bg-white/80 px-4 py-3">
              واجهة عربية مصممة بتركيز على الخصوصية وسهولة الاستخدام.
            </div>
          </div>
        </section>

        <section className="w-full max-w-xl">
          <div className="rounded-3xl border border-brand-muted/40 bg-white/95 p-12 shadow-subtle backdrop-blur">
            <div className="mb-10 text-center">
              <div className="relative mx-auto mb-8 flex h-40 w-40 items-center justify-center">
                <span
                  className="absolute inset-0 rounded-full bg-brand-primary/20 blur-2xl"
                  aria-hidden="true"
                />
                <span
                  className="absolute inset-4 rounded-full bg-brand-soft/40 blur-lg"
                  aria-hidden="true"
                />
                <img
                  src={santraLogo}
                  alt="شعار Santra Task"
                  className="relative h-full w-full object-contain drop-shadow-[0_35px_55px_rgba(32,94,168,0.45)]"
                />
              </div>
              <span className="mb-3 inline-flex items-center gap-2 rounded-full bg-brand-primary/10 px-4 py-1 text-xs font-semibold text-brand-primary">
                أهلاً بعودتك
              </span>
              <h1 className="font-display text-3xl font-bold text-brand-primary">Santra Task</h1>
              <p className="mt-3 text-sm text-brand-ink/60">
                استخدم بيانات الدخول للمتابعة إلى لوحة التحكم الخاصة بك.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              <label className="block space-y-2 text-right">
                <span className="text-xs font-medium text-brand-ink/70">اسم المستخدم</span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full rounded-2xl border border-brand-muted/60 bg-white px-4 py-3 text-sm text-brand-ink placeholder:text-brand-ink/30 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                  placeholder="أدخل اسم المستخدم"
                  required
                />
              </label>

              <label className="block space-y-2 text-right">
                <span className="text-xs font-medium text-brand-ink/70">كلمة المرور</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-2xl border border-brand-muted/60 bg-white px-4 py-3 text-sm text-brand-ink placeholder:text-brand-ink/30 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                  placeholder="••••••••"
                  required
                />
              </label>

              <button
                type="submit"
                className="w-full rounded-full bg-brand-primary px-5 py-3 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-primaryDark focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:ring-offset-2 focus:ring-offset-white"
              >
                تسجيل الدخول
              </button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}