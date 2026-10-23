import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '@/App';
import { installFakeServer, sampleProject, users } from '@/test/fake-server';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const withProgress = (progress: number) => ({
  ...sampleProject,
  phases: [{ ...sampleProject.phases[0], progress }],
});

async function openTimeline(user: ReturnType<typeof userEvent.setup>) {
  window.history.replaceState(null, '', '/project/delhi-lounge');
  render(<App />);
  expect(await screen.findByRole('heading', { name: /Delhi Lounge/ }, { timeout: 3000 })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: /^Timeline/ }));
}

async function saveStageProgress(user: ReturnType<typeof userEvent.setup>, value: string) {
  await user.click(screen.getByRole('button', { name: 'Update stage' }));
  const form = screen.getByRole('button', { name: 'Save stage update' }).closest('form')!;
  const input = within(form).getByLabelText('Progress %');
  await user.clear(input);
  await user.type(input, value);
  await user.click(within(form).getByRole('button', { name: 'Save stage update' }));
}

afterEach(() => {
  vi.useRealTimers();
});

describe('saving a stage', () => {
  it('says so and shows the real value when the server refuses the save', async () => {
    installFakeServer({
      session: users.lead,
      handle: (route) => {
        if (route === 'PATCH /api/projects/delhi-lounge/phases/ph-1') return json(400, { error: 'Validation failed' });
        if (route === 'GET /api/projects/delhi-lounge') return json(200, { project: withProgress(40) });
        return undefined;
      },
    });
    const user = userEvent.setup();
    await openTimeline(user);
    await saveStageProgress(user, '65');

    expect(await screen.findByText('Couldn\'t save stage "Design development"')).toBeInTheDocument();
    expect(screen.getByText(/Validation failed Your change was not saved\./)).toBeInTheDocument();
    expect(screen.queryByText('65%')).not.toBeInTheDocument();
  });

  it('keeps a saved value when an older background refresh arrives after the save', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let releaseRefresh: () => void = () => {};
    let loads = 0;
    let serverProgress = 40;
    installFakeServer({
      session: users.lead,
      handle: (route, body) => {
        if (route === 'GET /api/projects') {
          loads++;
          if (loads === 1) return json(200, { projects: [withProgress(serverProgress)] });
          // The refresh reads the data now, before the save, and arrives later.
          const stale = json(200, { projects: [withProgress(serverProgress)] });
          return new Promise<Response>((resolve) => {
            releaseRefresh = () => resolve(stale);
          });
        }
        if (route === 'PATCH /api/projects/delhi-lounge/phases/ph-1') {
          serverProgress = body.progress;
          return json(200, { project: withProgress(serverProgress) });
        }
        return undefined;
      },
    });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await openTimeline(user);

    await act(async () => {
      vi.advanceTimersByTime(15_000); // the background refresh starts
    });
    await saveStageProgress(user, '65');
    expect(await screen.findAllByText('65%')).not.toHaveLength(0);

    await act(async () => {
      releaseRefresh(); // the old copy lands after the save
    });
    expect(screen.getAllByText('65%')).not.toHaveLength(0);
    expect(serverProgress).toBe(65);
  });
});
