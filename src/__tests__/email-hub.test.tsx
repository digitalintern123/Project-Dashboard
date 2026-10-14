import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '@/App';
import { installFakeServer, users } from '@/test/fake-server';

describe('Email Hub settings', () => {
  it('shows Microsoft 365 only as connected: no Azure IDs, secrets, sender or From fields', async () => {
    const server = installFakeServer({ session: users.coordinator });
    window.history.replaceState(null, '', '/');
    render(<App />);
    const user = userEvent.setup();
    await user.click(await screen.findByTitle('Email Outbox & Delivery Radar', {}, { timeout: 3000 }));
    await user.click(screen.getByRole('button', { name: /Email Settings/ }));

    expect(await screen.findByText(/Microsoft 365: connected/)).toBeInTheDocument();
    expect(screen.getByText(/each user's own mailbox/)).toBeInTheDocument();
    for (const label of [/Tenant/i, /Client ID/i, /Client Secret/i, /Sender Mailbox/i, /"From" Email/i]) {
      expect(screen.queryByLabelText(label)).not.toBeInTheDocument();
    }
    expect(screen.queryByText(/Microsoft Graph API \(Azure AD\)/)).not.toBeInTheDocument();

    // The test email goes to the signed-in coordinator; nothing else is sent.
    const form = screen.getByRole('button', { name: /Send me a test email/ }).closest('form')!;
    expect(within(form).getByText(`to ${users.coordinator.email}`)).toBeInTheDocument();
    await user.click(within(form).getByRole('button', { name: /Send me a test email/ }));
    const test = server.requests.find((r) => r.path === '/api/email/test');
    expect(test?.body).toEqual({});
  });
});
