import { describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '@/App';
import { installFakeServer, sampleProject, users } from '@/test/fake-server';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const mumbaiProject = { ...sampleProject, location: 'Mumbai' };

async function openNewProject() {
  window.history.replaceState(null, '', '/new-project');
  render(<App />);
  expect(await screen.findByRole('heading', { name: 'Create new project' }, { timeout: 3000 })).toBeInTheDocument();
}

async function fillRequired(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByPlaceholderText('e.g. Terminal 3 Premium Lounge'), 'Airport Lounge');
  const target = screen.getByText('Project Completion Date (Target) *').parentElement!.querySelector('input')!;
  await user.type(target, '2027-12-31');
}

describe('custom project location', () => {
  it('creates a project in a location that is not on the list', async () => {
    let sent: Record<string, unknown> | undefined;
    installFakeServer({
      session: users.lead,
      handle: (route, body) => {
        if (route === 'POST /api/projects') {
          sent = body;
          return json(201, { project: { ...sampleProject, ...body } });
        }
        return undefined;
      },
    });
    const user = userEvent.setup();
    await openNewProject();
    await fillRequired(user);
    await user.selectOptions(screen.getByLabelText('Location'), 'Other location…');
    await user.type(screen.getByLabelText('Other location'), '  navi  mumbai ');
    await user.click(screen.getByRole('button', { name: /Create project/ }));

    await waitFor(() => expect(sent).toBeDefined(), { timeout: 3000 });
    expect(sent).toMatchObject({ location: 'Navi Mumbai', code: expect.stringMatching(/^NAV-NEW-/) });
    expect(sent!.id).toMatch(/^navi-mumbai-airport-lounge-/);
  });

  it('reuses the existing spelling when the typed name matches a known location', async () => {
    let sent: Record<string, unknown> | undefined;
    installFakeServer({
      session: users.lead,
      handle: (route, body) => {
        if (route === 'POST /api/projects') {
          sent = body;
          return json(201, { project: { ...sampleProject, ...body } });
        }
        return undefined;
      },
    });
    const user = userEvent.setup();
    await openNewProject();
    await fillRequired(user);
    await user.selectOptions(screen.getByLabelText('Location'), 'Other location…');
    await user.type(screen.getByLabelText('Other location'), 'HYDERABAD');
    await user.click(screen.getByRole('button', { name: /Create project/ }));

    await waitFor(() => expect(sent).toBeDefined(), { timeout: 3000 });
    expect(sent).toMatchObject({ location: 'Hyderabad' });
  });

  it('does not create a project while the other-location box is empty', async () => {
    let posted = false;
    installFakeServer({
      session: users.lead,
      handle: (route) => {
        if (route === 'POST /api/projects') posted = true;
        return undefined;
      },
    });
    const user = userEvent.setup();
    await openNewProject();
    await fillRequired(user);
    await user.selectOptions(screen.getByLabelText('Location'), 'Other location…');
    const box = screen.getByLabelText('Other location');
    expect(box).toHaveFocus();
    expect(box).toBeRequired();
    // Bypass the browser's own required-field check to reach the form's check.
    box.removeAttribute('required');
    await user.click(screen.getByRole('button', { name: /Create project/ }));

    expect(await screen.findByText('Enter the location.')).toBeInTheDocument();
    expect(posted).toBe(false);
  });

  it('shows a custom location in Edit project and in the dashboard filter', async () => {
    installFakeServer({
      session: users.coordinator,
      handle: (route) => {
        if (route === 'GET /api/projects') return json(200, { projects: [mumbaiProject] });
        if (route === 'GET /api/projects/delhi-lounge') return json(200, { project: mumbaiProject });
        return undefined;
      },
    });
    const user = userEvent.setup();
    window.history.replaceState(null, '', '/project/delhi-lounge');
    render(<App />);
    expect(await screen.findByRole('heading', { name: /Delhi Lounge/ }, { timeout: 3000 })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Edit project/ }));
    const picker = screen.getByLabelText('Location') as HTMLSelectElement;
    expect(picker.value).toBe('Mumbai');
    expect(screen.queryByLabelText('Other location')).not.toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: /^Cancel$/ })[0]);

    await user.click(screen.getAllByRole('link', { name: /Portfolio overview/ })[0]);
    await user.click(await screen.findByRole('button', { name: /Filters/ }));
    const filter = await screen.findByTestId('select-location-filter');
    expect(within(filter).getByRole('option', { name: 'Mumbai' })).toBeInTheDocument();
  });
});
