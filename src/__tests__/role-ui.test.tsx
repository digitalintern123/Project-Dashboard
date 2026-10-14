import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '@/App';
import { installFakeServer, users, type FakeUser } from '@/test/fake-server';

async function openProject(session: FakeUser) {
  installFakeServer({ session });
  window.history.replaceState(null, '', '/project/delhi-lounge');
  render(<App />);
  // Wait for the project to load from the API.
  expect(await screen.findByRole('heading', { name: /Delhi Lounge/ }, { timeout: 3000 })).toBeInTheDocument();
}

const editButton = () => screen.queryByRole('button', { name: /edit project/i });
const deleteButton = () => screen.queryByRole('button', { name: /delete project/i });
const newProjectLink = () => screen.queryByRole('link', { name: /new project/i });

async function photosTabUploadButton() {
  await userEvent.setup().click(screen.getByRole('button', { name: /^Site Photograph/ }));
  return screen.queryAllByRole('button', { name: /upload site photographs/i });
}

describe('role-based UI', () => {
  it('HOD sees the project read-only: no edit, delete, upload or new-project controls', async () => {
    await openProject(users.hod);
    expect(editButton()).not.toBeInTheDocument();
    expect(deleteButton()).not.toBeInTheDocument();
    expect(newProjectLink()).not.toBeInTheDocument();
    expect(await photosTabUploadButton()).toHaveLength(0);
  });

  it('the assigned lead can edit and upload, but not delete the project', async () => {
    await openProject(users.lead);
    expect(editButton()).toBeInTheDocument();
    expect(deleteButton()).not.toBeInTheDocument();
    expect(newProjectLink()).toBeInTheDocument();
    expect(await photosTabUploadButton()).not.toHaveLength(0);
  });

  it('a lead who is not assigned to the project cannot edit it', async () => {
    await openProject({ ...users.lead, id: 'u-other-lead', name: 'Other Lead' });
    expect(editButton()).not.toBeInTheDocument();
    expect(await photosTabUploadButton()).toHaveLength(0);
  });

  it('a viewer sees the project strictly read-only: no edit, tag, upload or new-project controls', async () => {
    await openProject({ ...users.hod, id: 'u-viewer', name: 'Vera Viewer', role: 'viewer' });
    expect(editButton()).not.toBeInTheDocument();
    expect(deleteButton()).not.toBeInTheDocument();
    expect(newProjectLink()).not.toBeInTheDocument();
    expect(screen.getByText('View only')).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: /^Timeline/ }));
    expect(screen.queryAllByTitle(/Tag individuals/)).toHaveLength(0);
    expect(await photosTabUploadButton()).toHaveLength(0);
  });

  it('the coordinator can edit and delete', async () => {
    await openProject(users.coordinator);
    expect(editButton()).toBeInTheDocument();
    expect(deleteButton()).toBeInTheDocument();
  });
});

describe('dashboard resilience', () => {
  it('renders projects whose category is outside the known list', async () => {
    const { sampleProject } = await import('@/test/fake-server');
    const original = sampleProject.category;
    sampleProject.category = 'Airport Lounge';
    try {
      installFakeServer({ session: users.lead });
      render(<App />);
      expect(await screen.findAllByText('Delhi Lounge', undefined, { timeout: 3000 })).not.toHaveLength(0);
      expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
    } finally {
      sampleProject.category = original;
    }
  });
});
