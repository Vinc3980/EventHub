import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import App from '../App';
import { AuthProvider } from '../app/AuthProvider';
import { AppShell } from '../layouts/AppShell';
import LoginScreen from '../screens/shared/LoginScreen';
import { resetDatabase } from './setup';

beforeEach(async () => {
  await resetDatabase();
});

describe('LoginScreen', () => {
  it('renders the email and password fields plus the demo hint', async () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginScreen />} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(screen.getByLabelText(/^email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log in' })).toBeInTheDocument();

    expect(screen.getByText('Demo account')).toBeInTheDocument();
    expect(screen.getByText(/Password: demo123/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fill demo account for Attendee' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fill demo account for Organizer' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fill demo account for Admin' })).toBeInTheDocument();
  });
});

describe('app routing', () => {
  it('mounts the /login route without throwing', async () => {
    window.history.pushState({}, '', '/login');

    render(<App />);

    expect(await screen.findByText('Welcome back', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByLabelText(/^email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password/i)).toBeInTheDocument();
  });
});

describe('AppShell', () => {
  it('shows the four bottom tabs at mobile width', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 375 });
    window.dispatchEvent(new Event('resize'));

    render(
      <MemoryRouter initialEntries={['/home']}>
        <AuthProvider>
          <AppShell />
        </AuthProvider>
      </MemoryRouter>,
    );

    const navs = screen.getAllByRole('navigation');
    const bottom = navs.find((nav) =>
      Array.from(nav.querySelectorAll('span')).some((span) => span.textContent === 'Chat'),
    );
    if (!bottom) throw new Error('bottom tab bar was not rendered');

    expect(bottom.querySelectorAll('a')).toHaveLength(4);
    expect(within(bottom).getByText('Home')).toBeInTheDocument();
    expect(within(bottom).getByText('Explore')).toBeInTheDocument();
    expect(within(bottom).getByText('Chat')).toBeInTheDocument();
    expect(within(bottom).getByText('Profile')).toBeInTheDocument();
  });
});
