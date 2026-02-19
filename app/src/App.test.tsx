import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('App', () => {
  it('renders the app title in the sidebar', () => {
    render(<App />);
    expect(screen.getByText('Life Tracker Ultimate')).toBeInTheDocument();
  });

  it('renders the default route (Daily Log)', () => {
    render(<App />);
    expect(screen.getByText('Daily Log', { selector: 'h1' })).toBeInTheDocument();
  });
});
