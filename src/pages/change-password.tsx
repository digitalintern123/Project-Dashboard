import { FormEvent, useState } from 'react';
import { KeyRound, Loader2, LogOut } from 'lucide-react';
import { useAppState } from '@/state/app-state';
import { BrandLogo } from '@/components/brand-logo';

const MIN_LENGTH = 10;

function policyError(password: string): string | null {
  if (password.length < MIN_LENGTH) return `Use at least ${MIN_LENGTH} characters.`;
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return 'Use both letters and numbers.';
  return null;
}

/** Shown instead of the app while the server requires the user to change their password. */
export default function ChangePassword() {
  const { user, changePassword, logout } = useAppState();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    const problem = policyError(newPassword);
    if (problem) return setError(problem);
    if (newPassword !== confirmPassword) return setError('The new passwords do not match.');
    if (newPassword === currentPassword) return setError('Choose a password different from your current one.');

    setSaving(true);
    const res = await changePassword(currentPassword, newPassword);
    setSaving(false);
    if (!res.success) setError(res.error || 'Failed to change password.');
  };

  const field = (label: string, value: string, onChange: (v: string) => void, autoComplete: string) => (
    <label className="block">
      <span className="mb-2 block text-[11px] font-bold text-[#173e49]">{label}</span>
      <input
        type="password"
        required
        autoComplete={autoComplete}
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-border bg-white px-3.5 py-3 text-[12px] outline-none focus:border-[#c9a04e]"
      />
    </label>
  );

  return (
    <main className="grain flex min-h-[100dvh] items-center justify-center bg-[#173e49] px-5 py-10 text-[#173e49]">
      <div className="w-full max-w-[440px] rounded-[28px] border border-white/10 bg-[#f7f4ec] p-7 shadow-2xl shadow-black/20 sm:p-10">
        <BrandLogo variant="full" theme="light" size="md" />
        <p className="mt-8 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.2em] text-[#9a711f]">
          <KeyRound size={13} /> Password update required
        </p>
        <h1 className="mt-3 font-serif text-[32px] leading-none tracking-[-.04em]">Set a new password</h1>
        <p className="mt-3 text-[12px] leading-5 text-muted-foreground">
          {user?.name ? `${user.name}, you` : 'You'} are using a temporary password. Choose a new one to continue: at
          least {MIN_LENGTH} characters, with letters and numbers.
        </p>

        <form onSubmit={submit} className="mt-7 space-y-4">
          {field('Current password', currentPassword, setCurrentPassword, 'current-password')}
          {field('New password', newPassword, setNewPassword, 'new-password')}
          {field('Confirm new password', confirmPassword, setConfirmPassword, 'new-password')}

          {error && (
            <p role="alert" className="rounded-lg bg-[#fae5e1] px-3 py-2 text-[11px] font-semibold text-[#b2473d]">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#d6a95d] px-4 py-3.5 text-[12px] font-extrabold text-[#173e49] transition hover:bg-[#e2bd73] disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 size={15} className="animate-spin" /> Saving...
              </>
            ) : (
              'Update password and continue'
            )}
          </button>
        </form>

        <button
          type="button"
          onClick={logout}
          className="mt-5 flex w-full items-center justify-center gap-2 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
        >
          <LogOut size={13} /> Sign out
        </button>
      </div>
    </main>
  );
}
