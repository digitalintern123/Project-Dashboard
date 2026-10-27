import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '@/App';
import { installFakeServer, sampleProject, users } from '@/test/fake-server';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const lena = {
  id: 'u-lena',
  name: 'Lena Second',
  email: 'lena@encalm.com',
  role: 'lead',
  title: 'Project Lead',
  initials: 'LS',
};
const lenasProject = { ...sampleProject, leadId: 'u-lena' };

describe('Project Lead names', () => {
  it('shows the real lead on another lead’s project', async () => {
    installFakeServer({
      session: users.lead,
      handle: (route) => {
        if (route === 'GET /api/projects') return json(200, { projects: [lenasProject] });
        if (route === 'GET /api/projects/delhi-lounge') return json(200, { project: lenasProject });
        if (route === 'GET /api/auth/leads') return json(200, { leads: [users.lead, lena] });
        return undefined;
      },
    });
    window.history.replaceState(null, '', '/project/delhi-lounge');
    render(<App />);
    expect(await screen.findByText(/View only · Allotted to Lena Second/, {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.queryByText(/Allotted to Unassigned/)).not.toBeInTheDocument();
  });

  it('lists the lead in All projects and matches a search by lead name', async () => {
    installFakeServer({ session: users.coordinator });
    window.history.replaceState(null, '', '/projects');
    render(<App />);
    const user = userEvent.setup();
    expect(await screen.findAllByText('Lee Lead', {}, { timeout: 3000 })).not.toHaveLength(0);
    await user.type(screen.getAllByPlaceholderText(/Search/)[0], 'Lee');
    expect(await screen.findAllByText('Delhi Lounge')).not.toHaveLength(0);
  });
});
