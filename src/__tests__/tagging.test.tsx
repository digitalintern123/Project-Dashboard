import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '@/App';
import { installFakeServer, users } from '@/test/fake-server';

const akash = (id: string, email: string) => ({
  id,
  name: 'Akash Kumar',
  email,
  role: 'lead' as const,
  title: 'Engineer',
  initials: 'AK',
});

describe('tagging people who share a name', () => {
  it('asks which one, then emails only the person picked', async () => {
    const server = installFakeServer({
      session: users.lead,
      extraUsers: [akash('u-ak1', 'akash.kumar@encalm.com'), akash('u-ak2', 'akash.k2@encalm.com')],
    });
    window.history.replaceState(null, '', '/project/delhi-lounge');
    render(<App />);
    await screen.findByRole('heading', { name: /Delhi Lounge/ }, { timeout: 3000 });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /^Timeline/ }));

    await user.click(screen.getAllByTitle(/Tag individuals/)[0]);
    const comment = screen.getByPlaceholderText(/Type @person to tag/);
    await user.type(comment, '@Akash Kumar please check');

    const chooser = await screen.findByRole('group', { name: 'Which Akash Kumar?' });
    const send = screen.getByRole('button', { name: /Tag & Send Mail/ });
    expect(send).toBeDisabled();

    await user.click(within(chooser).getByRole('button', { name: /akash\.k2@encalm\.com/ }));
    expect(screen.queryByRole('group', { name: 'Which Akash Kumar?' })).not.toBeInTheDocument();
    const willEmail = screen.getByText('Will email:').parentElement!;
    expect(willEmail).toHaveTextContent('akash.k2@encalm.com');
    expect(willEmail).not.toHaveTextContent('akash.kumar@encalm.com');

    await user.click(send);
    const sent = server.requests.find((r) => r.path === '/api/email/tag-and-comment');
    expect(sent?.body.taggedUserIds).toEqual(['u-ak2']);
    expect(await screen.findByText(/waiting in the Outbox/)).toBeInTheDocument();
  });

  it('suggests people for a misspelt name and narrows by surname', async () => {
    installFakeServer({
      session: users.lead,
      extraUsers: [
        akash('u-ak1', 'akash.kumar@encalm.com'),
        { ...akash('u-ad', 'akash.deep@encalm.com'), name: 'Akash Deep' },
      ],
    });
    window.history.replaceState(null, '', '/project/delhi-lounge');
    render(<App />);
    await screen.findByRole('heading', { name: /Delhi Lounge/ }, { timeout: 3000 });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /^Timeline/ }));
    await user.click(screen.getAllByTitle(/Tag individuals/)[0]);
    const comment = screen.getByPlaceholderText(/Type @person to tag/);

    await user.type(comment, '@aksh');
    // The suggestion list (its header, then the people).
    const list = () => screen.getByText('Encalm Directory (@)').closest('div')!.parentElement!.parentElement!;
    expect(list()).toHaveTextContent('akash.deep@encalm.com');
    expect(list()).toHaveTextContent('akash.kumar@encalm.com');
    expect(list().querySelector('mark')).not.toBeNull();

    await user.clear(comment);
    await user.type(comment, '@akash d');
    expect(list()).toHaveTextContent('akash.deep@encalm.com');
    expect(list()).not.toHaveTextContent('akash.kumar@encalm.com');
  });

  it("shows the Tag button to HODs, but not to a lead on someone else's project", async () => {
    for (const [session, visible] of [
      [users.hod, true],
      [{ ...users.lead, id: 'u-other-lead' }, false],
    ] as const) {
      installFakeServer({ session });
      window.history.replaceState(null, '', '/project/delhi-lounge');
      const { unmount } = render(<App />);
      await screen.findByRole('heading', { name: /Delhi Lounge/ }, { timeout: 3000 });
      await userEvent.setup().click(screen.getByRole('button', { name: /^Timeline/ }));
      expect(screen.queryAllByTitle(/Tag individuals/).length > 0).toBe(visible);
      unmount();
    }
  });
});
