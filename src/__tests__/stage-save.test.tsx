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

  it('says so and keeps "Pending" when a milestone approval is refused', async () => {
    const pending = {
      ...sampleProject,
      milestones: [
        {
          id: 'ms-1',
          title: 'Design freeze',
          date: '2026-12-01',
          status: 'upcoming',
          approvalRequired: true,
          approvalStatus: 'Pending',
        },
      ],
    };
    installFakeServer({
      session: users.coordinator,
      handle: (route) => {
        if (route === 'GET /api/projects') return json(200, { projects: [pending] });
        if (route === 'GET /api/projects/delhi-lounge') return json(200, { project: pending });
        if (route === 'PATCH /api/projects/delhi-lounge/milestones/ms-1')
          return json(400, { error: 'Validation failed' });
        return undefined;
      },
    });
    const user = userEvent.setup();
    window.history.replaceState(null, '', '/project/delhi-lounge');
    render(<App />);
    expect(await screen.findByRole('heading', { name: /Delhi Lounge/ }, { timeout: 3000 })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Milestones/ }));
    await user.click(screen.getAllByRole('button', { name: /Approve/ })[0]);

    expect(await screen.findByText('Couldn\'t save the approval of milestone "Design freeze"')).toBeInTheDocument();
    expect(screen.getAllByText(/Approval · Pending/)).not.toHaveLength(0);
    expect(screen.queryByText(/Approval · Approved/)).not.toBeInTheDocument();
  });

  it('keeps a deleted photo deleted when an older background refresh arrives after it', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const photo = {
      id: 'ph-photo-1',
      projectId: 'delhi-lounge',
      url: '/uploads/delhi-lounge/site.webp',
      caption: 'Site walk',
      uploadedBy: 'Lee Lead',
    };
    let photos = [photo];
    let releaseRefresh: () => void = () => {};
    let loads = 0;
    installFakeServer({
      session: users.lead,
      handle: (route) => {
        if (route === 'GET /api/projects') {
          loads++;
          const reply = json(200, { projects: [{ ...sampleProject, photos }] });
          if (loads === 1) return reply;
          return new Promise<Response>((resolve) => {
            releaseRefresh = () => resolve(reply);
          });
        }
        if (route === 'DELETE /api/projects/delhi-lounge/photos/ph-photo-1') {
          photos = [];
          return json(200, { message: 'deleted' });
        }
        return undefined;
      },
    });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    window.history.replaceState(null, '', '/project/delhi-lounge');
    render(<App />);
    expect(await screen.findByRole('heading', { name: /Delhi Lounge/ }, { timeout: 3000 })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Site Photograph/ }));

    await act(async () => {
      vi.advanceTimersByTime(15_000); // the background refresh starts, still with the photo
    });
    await user.click(screen.getByRole('button', { name: 'Delete Photograph' }));
    expect(await screen.findByText('No Site Photographs Uploaded Yet')).toBeInTheDocument();

    await act(async () => {
      releaseRefresh(); // the old copy, with the photo, lands after the delete
    });
    expect(screen.getByText('No Site Photographs Uploaded Yet')).toBeInTheDocument();
  });
});
