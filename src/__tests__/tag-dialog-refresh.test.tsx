import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '@/App';
import { installFakeServer, users } from '@/test/fake-server';

afterEach(() => {
  vi.useRealTimers();
});

describe('the Tag dialog', () => {
  it('keeps the people you ticked when the page refreshes in the background', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const server = installFakeServer({ session: users.lead });
    window.history.replaceState(null, '', '/project/delhi-lounge');
    render(<App />);
    await screen.findByRole('heading', { name: /Delhi Lounge/ }, { timeout: 3000 });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.click(screen.getByRole('button', { name: /^Timeline/ }));
    await user.click(screen.getAllByTitle(/Tag individuals/)[0]);
    await user.click(screen.getByRole('button', { name: /Hal Od/ }));
    expect(screen.getByText('Will email:').parentElement!).toHaveTextContent('Hal Od');

    const loads = () => server.requests.filter((r) => r.path === '/api/projects' && r.method === 'GET').length;
    const before = loads();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(16_000);
    });
    expect(loads()).toBeGreaterThan(before);

    expect(screen.getByText('Will email:').parentElement!).toHaveTextContent('Hal Od');
    const send = screen.getByRole('button', { name: /Tag & Send Mail/ });
    expect(send).toBeEnabled();
    await user.click(send);
    const sent = server.requests.find((r) => r.path === '/api/email/tag-and-comment');
    expect(sent?.body.taggedUserIds).toEqual(['u-hod']);
  });
});
