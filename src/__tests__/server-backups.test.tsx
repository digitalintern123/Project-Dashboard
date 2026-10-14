import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '@/App';
import { installFakeServer, users } from '@/test/fake-server';

async function openSettings(session: (typeof users)[keyof typeof users]) {
  const server = installFakeServer({ session });
  window.history.replaceState(null, '', '/');
  render(<App />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Open settings' }, { timeout: 3000 }));
  return { server, user };
}

describe('Server backups card', () => {
  it('shows the coordinator the backup status and backs up on demand', async () => {
    const { server, user } = await openSettings(users.coordinator);
    expect(await screen.findByText('No backup yet.')).toBeInTheDocument();
    expect(screen.getByText(/Automatic daily at 02:15/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Back up now' }));
    expect(await screen.findByText(/Last backup:.*2\.3 MB.*1\s+kept/)).toBeInTheDocument();
    expect(server.requests.some((r) => r.method === 'POST' && r.path === '/api/system/backups')).toBe(true);
  });

  it('is not shown to leads', async () => {
    await openSettings(users.lead);
    expect(screen.queryByText('Server backups')).not.toBeInTheDocument();
  });
});
