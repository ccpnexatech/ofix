import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import HomePage from './page';

describe('HomePage', () => {
  it('renders the app name coming from the shared package', () => {
    render(<HomePage />);

    expect(screen.getByRole('heading', { level: 1, name: 'OFIX' })).toBeTruthy();
  });
});
