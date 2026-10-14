import { describe, expect, it, vi } from 'vitest';
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

  it('does not crash when an older server answers with the old settings shape', async () => {
    const server = installFakeServer({ session: users.coordinator });
    const fakeFetch = globalThis.fetch as unknown as (i: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) =>
      String(input).includes('/api/email/settings')
        ? new Response(
            JSON.stringify({
              settings: {
                provider: 'smtp',
                smtp: { host: 'smtp.office365.com', port: 587, secure: false, user: '', pass: '', fromEmail: '' },
                graph: {
                  tenantId: 't',
                  clientId: 'c',
                  clientSecret: '••••',
                  senderEmail: 'x@y',
                  saveToSentItems: true,
                },
                isConfigured: false,
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          )
        : fakeFetch(input, init),
    );
    void server;
    window.history.replaceState(null, '', '/');
    render(<App />);
    const user = userEvent.setup();
    await user.click(await screen.findByTitle('Email Outbox & Delivery Radar', {}, { timeout: 3000 }));
    await user.click(screen.getByRole('button', { name: /Email Settings/ }));
    expect(await screen.findByText(/Microsoft 365: not configured/)).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });
});
