import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Router } from 'wouter';
import { ProjectCard, ProjectRow } from '@/features/dashboard/project-row';
import { categoryIcons } from '@/features/dashboard/constants';
import { sampleProject } from '@/test/fake-server';
import type { Project } from '@/data/projects';

const project = sampleProject as unknown as Project;

describe('project category icons', () => {
  it('names the category when hovering the icon, in rows and cards', () => {
    render(
      <Router>
        <ProjectRow project={project} index={0} />
        <ProjectCard project={{ ...project, category: 'Kitchen' }} index={1} />
      </Router>,
    );
    expect(screen.getByTitle('Lounge')).toBeInTheDocument();
    expect(screen.getByTitle('Kitchen')).toBeInTheDocument();
  });

  it('has a distinct icon for each category', () => {
    const icons = Object.values(categoryIcons);
    expect(new Set(icons).size).toBe(icons.length);
  });
});
