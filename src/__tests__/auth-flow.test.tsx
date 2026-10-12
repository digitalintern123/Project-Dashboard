import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '@/App';
import { installFakeServer, users } from '@/test/fake-server';

async function signIn(email: string, password: string) {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText('Email'), email);
  await user.type(screen.getByLabelText('Password', { selector: 'input' }), password);
  await user.click(screen.getByRole('button', { name: /sign in/i }));
  return user;
}

describe('login page', () => {
  it('shows the login form when there is no session, without demo accounts', async () => {
    installFakeServer();
    render(<App />);
    expect(await screen.findByRole('button', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.queryByText(/demo/i)).not.toBeInTheDocument();
    await waitFor(() => expect(window.location.pathname).toBe('/login'));
  });

  it('shows the server error for wrong credentials and stays on the login page', async () => {
    installFakeServer();
    render(<App />);
    await signIn(users.lead.email, 'wrong-password-1');
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('signs in, sends the CSRF header with credentials, and opens the dashboard', async () => {
    const server = installFakeServer();
    render(<App />);
    await signIn(users.lead.email, users.lead.password);
    expect(await screen.findAllByText(/Portfolio overview/i, undefined, { timeout: 3000 })).not.toHaveLength(0);

    const login = server.requests.find((r) => r.path === '/api/auth/login')!;
    expect(login.headers['X-Requested-With']).toBe('XMLHttpRequest');
    expect(login.body).toEqual({ email: users.lead.email, password: users.lead.password });
    // Nothing is kept in localStorage: the session lives in an httpOnly cookie.
    expect(localStorage.getItem('encalm-auth-token')).toBeNull();
  });

  it('restores an existing session on load', async () => {
    installFakeServer({ session: users.coordinator });
    render(<App />);
    expect(await screen.findAllByText(/Portfolio overview/i, undefined, { timeout: 3000 })).not.toHaveLength(0);
  });

  it('logs out back to the login page', async () => {
    const server = installFakeServer({ session: users.lead });
    render(<App />);
    await screen.findAllByText(/Portfolio overview/i, undefined, { timeout: 3000 });
    await userEvent.setup().click(screen.getAllByText(/logout/i)[0]);
    expect(await screen.findByRole('button', { name: /sign in/i })).toBeInTheDocument();
    expect(server.requests.some((r) => r.path === '/api/auth/logout')).toBe(true);
  });
});

describe('forced password change', () => {
  it('blocks the app until a valid new password is set', async () => {
    installFakeServer({ mustChangePassword: true });
    render(<App />);
    const user = await signIn(users.hod.email, users.hod.password);

    expect(await screen.findByText('Set a new password')).toBeInTheDocument();
    expect(screen.queryAllByText(/Portfolio overview/i)).toHaveLength(0);

    const current = screen.getByLabelText('Current password');
    const next = screen.getByLabelText('New password');
    const confirm = screen.getByLabelText('Confirm new password');
    const submit = screen.getByRole('button', { name: /update password/i });

    // Client-side policy checks
    await user.type(current, users.hod.password);
    await user.type(next, 'short1');
    await user.type(confirm, 'short1');
    await user.click(submit);
    expect(await screen.findByRole('alert')).toHaveTextContent('at least 10 characters');

    await user.clear(next);
    await user.clear(confirm);
    await user.type(next, 'Brand-new-pass-1');
    await user.type(confirm, 'Different-pass-1');
    await user.click(submit);
    expect(await screen.findByRole('alert')).toHaveTextContent('do not match');

    await user.clear(confirm);
    await user.type(confirm, 'Brand-new-pass-1');
    await user.click(submit);
    expect(await screen.findAllByText(/Portfolio overview/i, undefined, { timeout: 3000 })).not.toHaveLength(0);
  });

  it('shows the server error when the current password is wrong', async () => {
    installFakeServer({ session: users.hod, mustChangePassword: true });
    render(<App />);
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Current password'), 'not-my-password-1');
    await user.type(screen.getByLabelText('New password'), 'Brand-new-pass-1');
    await user.type(screen.getByLabelText('Confirm new password'), 'Brand-new-pass-1');
    await user.click(screen.getByRole('button', { name: /update password/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Current password is incorrect');
  });
});
