import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '@/App';
import { installFakeServer, users } from '@/test/fake-server';

async function openEmailUpdate() {
  window.history.replaceState(null, '', '/project/delhi-lounge');
  render(<App />);
  await screen.findByRole('heading', { name: /Delhi Lounge/ }, { timeout: 3000 });
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: /Email Update/ }));
  return { user, to: await screen.findByPlaceholderText(/Type @/) };
}

describe('Email Update recipients', () => {
  it('lets you pick an HOD and a Coordinator with @, not only Project Leads', async () => {
    installFakeServer({ session: users.lead });
    const { user, to } = await openEmailUpdate();

    await user.type(to, '@Hal');
    await user.click(await screen.findByRole('button', { name: /Hal Od/ }));
    await user.type(to, '@Cora');
    await user.click(await screen.findByRole('button', { name: /Cora Ordinator/ }));

    expect(await screen.findByText(/2 recipients tagged/i)).toBeInTheDocument();
  });

  it('shows a current example in the hint, not a deleted account', async () => {
    installFakeServer({ session: users.lead });
    const { to } = await openEmailUpdate();
    expect(to.getAttribute('placeholder')).not.toMatch(/Chinmay/);
  });
});
