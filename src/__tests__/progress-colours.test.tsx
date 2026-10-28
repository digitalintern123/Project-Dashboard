import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '@/App';
import { installFakeServer, sampleProject, users } from '@/test/fake-server';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const project = {
  ...sampleProject,
  phases: [
    { id: 'ph-1', name: 'Design development', status: 'active', progress: 40, owner: 'Design' },
    {
      id: 'ph-2',
      name: 'Procurement',
      status: 'active',
      progress: 10,
      owner: 'Sourcing',
      plannedStart: '2026-01-01',
      plannedFinish: '2026-07-31',
    },
    { id: 'ph-3', name: 'Execution', status: 'blocked', progress: 30, owner: 'Projects' },
  ],
};

afterEach(() => {
  vi.useRealTimers();
});

describe('progress bar colours', () => {
  it('colours each stage by its own schedule', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-04-01T10:00:00'));
    installFakeServer({
      session: users.lead,
      handle: (route) => {
        if (route === 'GET /api/projects') return json(200, { projects: [project] });
        if (route === 'GET /api/projects/delhi-lounge') return json(200, { project });
        return undefined;
      },
    });
    window.history.replaceState(null, '', '/project/delhi-lounge');
    render(<App />);
    await screen.findByRole('heading', { name: /Delhi Lounge/ }, { timeout: 3000 });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.click(screen.getByRole('button', { name: /^Timeline/ }));

    const bar = (reason: RegExp) => screen.getAllByTitle(reason)[0].firstElementChild!;
    // No planned dates: coloured by % (40% → amber).
    expect(bar(/40% done · no planned dates/)).toHaveAttribute('data-tone', 'amber');
    // Planned Jan → Jul: about 43% due by 1 Apr, only 10% done → red.
    expect(bar(/10% done · planned 43% by today · 33 points behind/)).toHaveAttribute('data-tone', 'red');
    // Blocked is always red.
    expect(bar(/30% done · blocked/)).toHaveAttribute('data-tone', 'red');
  });

  it('colours the project bar in All projects against its target date', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-04-01T10:00:00'));
    installFakeServer({ session: users.coordinator });
    window.history.replaceState(null, '', '/projects');
    render(<App />);
    // 1 Jan → 1 Jan 2027, 25% due by 1 Apr; 40% done → ahead → green.
    const reason = await screen.findByTitle(/40% done · planned 25% by today · 15 points ahead/, {}, { timeout: 3000 });
    expect(reason.firstElementChild).toHaveAttribute('data-tone', 'green');
  });
});
