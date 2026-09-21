import { FormEvent, useState } from 'react';
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { useAppState, type AppRole } from '@/state/app-state';

export default function Login() {
  const { login } = useAppState();
  const [email, setEmail] = useState('hod@encalm.com');
  const [password, setPassword] = useState('encalm');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const role: AppRole | null = email.trim().toLowerCase() === 'hod@encalm.com'
      ? 'hod'
      : email.trim().toLowerCase() === 'lead@encalm.com'
        ? 'lead'
        : null;
    if (!role || !password) {
      setError('Use one of the two demo accounts below.');
      return;
    }
    login(role);
  };

  return (
    <main className="grain flex min-h-[100dvh] items-center justify-center bg-[#173e49] px-5 py-10 text-[#173e49]">
      <div className="grid w-full max-w-[1000px] overflow-hidden rounded-[28px] border border-white/10 bg-[#f7f4ec] shadow-2xl shadow-black/20 lg:grid-cols-[.9fr_1.1fr]">
        <section className="relative hidden overflow-hidden bg-[#204f59] p-10 text-[#f7f4ec] lg:flex lg:flex-col lg:justify-between">
          <div className="absolute -right-20 -top-24 size-72 rounded-full border border-[#d6a95d]/20" />
          <div className="absolute -bottom-36 -left-20 size-96 rounded-full border border-[#d6a95d]/10" />
          <div>
            <img src="https://encalm.com/assets/image/Encalm-Logo-White.png" alt="Encalm" onError={(event) => { event.currentTarget.style.display = 'none'; }} className="h-9 w-auto object-contain object-left" />
            <p className="mt-2 font-mono text-[9px] uppercase tracking-[.24em] text-white/50">Projects · internal control office</p>
          </div>
          <div className="relative">
            <p className="font-mono text-[10px] uppercase tracking-[.2em] text-[#d6a95d]">Project control, with clarity</p>
            <h1 className="mt-5 max-w-[360px] font-serif text-[48px] leading-[.94] tracking-[-.05em]">A better view of the work that moves hospitality forward.</h1>
            <div className="mt-8 flex items-center gap-3 text-[12px] text-white/60"><ShieldCheck size={16} className="text-[#d6a95d]" /> Built for confident decisions and accurate updates.</div>
          </div>
          <p className="font-mono text-[9px] uppercase tracking-[.14em] text-white/35">Encalm Hospitality Pvt. Ltd.</p>
        </section>

        <section className="p-7 sm:p-12">
          <div className="mb-10 lg:hidden">
            <img src="https://encalm.com/assets/image/Encalm-Logo-Primary.png" alt="Encalm" onError={(event) => { event.currentTarget.style.display = 'none'; }} className="h-8 w-auto object-contain object-left" />
            <p className="mt-2 font-mono text-[9px] uppercase tracking-[.24em] text-muted-foreground">Projects · internal control office</p>
          </div>
          <div className="max-w-[380px]">
            <p className="font-mono text-[10px] uppercase tracking-[.2em] text-[#9a711f]">Welcome back</p>
            <h2 className="mt-3 font-serif text-[42px] leading-none tracking-[-.05em] text-[#173e49]">Sign in to<br />Encalm Projects.</h2>
            <p className="mt-4 text-[13px] leading-6 text-muted-foreground">Choose your demo role to preview the right level of portfolio access.</p>
            <form onSubmit={submit} className="mt-8 space-y-4">
              <label className="block"><span className="mb-2 block text-[11px] font-bold text-[#173e49]">Email</span><span className="flex items-center gap-2 rounded-xl border border-border bg-white px-3.5 py-3 focus-within:border-[#c9a04e]"><Mail size={15} className="text-muted-foreground" /><input type="email" required autoComplete="username" aria-label="Email" value={email} onChange={(event) => setEmail(event.target.value)} className="min-w-0 flex-1 bg-transparent text-[12px] outline-none" /></span></label>
              <label className="block"><span className="mb-2 block text-[11px] font-bold text-[#173e49]">Password</span><span className="flex items-center gap-2 rounded-xl border border-border bg-white px-3.5 py-3 focus-within:border-[#c9a04e]"><LockKeyhole size={15} className="text-muted-foreground" /><input type={showPassword ? 'text' : 'password'} required autoComplete="current-password" aria-label="Password" value={password} onChange={(event) => setPassword(event.target.value)} className="min-w-0 flex-1 bg-transparent text-[12px] outline-none" /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((value) => !value)} className="text-muted-foreground hover:text-foreground">{showPassword ? <EyeOff size={15} /> : <Eye size={15} />}</button></span></label>
              {error && <p role="alert" className="rounded-lg bg-[#fae5e1] px-3 py-2 text-[11px] font-semibold text-[#b2473d]">{error}</p>}
              <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#d6a95d] px-4 py-3.5 text-[12px] font-extrabold text-[#173e49] transition hover:bg-[#e2bd73]">Sign in <ArrowRight size={15} /></button>
            </form>
            <div className="mt-8 border-t border-border pt-5">
              <p className="font-mono text-[9px] uppercase tracking-[.15em] text-muted-foreground">Prototype accounts · any password</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <button type="button" onClick={() => { setEmail('hod@encalm.com'); setPassword('encalm'); }} className="rounded-xl border border-border bg-white p-3 text-left hover:border-[#c9a04e]"><span className="block text-[11px] font-bold text-[#173e49]">Ruchika Chauhan</span><span className="mt-1 block font-mono text-[9px] uppercase tracking-[.08em] text-muted-foreground">Project HOD</span></button>
                <button type="button" onClick={() => { setEmail('lead@encalm.com'); setPassword('encalm'); }} className="rounded-xl border border-border bg-white p-3 text-left hover:border-[#c9a04e]"><span className="block text-[11px] font-bold text-[#173e49]">Chinmay Saxena</span><span className="mt-1 block font-mono text-[9px] uppercase tracking-[.08em] text-muted-foreground">Project Lead</span></button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}