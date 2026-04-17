import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import ProtectedRoute from './ProtectedRoute';

function renderWithRouter(initialPath: string, roles?: string[]) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/protected" element={
          <ProtectedRoute roles={roles}>
            <div data-testid="protected-content">Secret</div>
          </ProtectedRoute>
        } />
        <Route path="/login" element={<div data-testid="login-page">Login</div>} />
        <Route path="/" element={<div data-testid="home-page">Home</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  useAuthStore.setState({ user: null, accessToken: null, isAuthenticated: false });
});

describe('ProtectedRoute', () => {
  it('redirects to /login when not authenticated', () => {
    renderWithRouter('/protected');
    expect(screen.getByTestId('login-page')).toBeTruthy();
    expect(screen.queryByTestId('protected-content')).toBeNull();
  });

  it('renders children when authenticated', () => {
    useAuthStore.setState({
      user: { id: '1', email: 'a@b.com', name: 'Test', role: 'PARTICIPANT', createdAt: '' },
      accessToken: 'token',
      isAuthenticated: true,
    });
    renderWithRouter('/protected');
    expect(screen.getByTestId('protected-content')).toBeTruthy();
  });

  it('shows Access Denied inline when role does not match', () => {
    useAuthStore.setState({
      user: { id: '1', email: 'a@b.com', name: 'Test', role: 'PARTICIPANT', createdAt: '' },
      accessToken: 'token',
      isAuthenticated: true,
    });
    renderWithRouter('/protected', ['ADMIN']);
    expect(screen.getByText(/Access Denied/i)).toBeTruthy();
    expect(screen.queryByTestId('protected-content')).toBeNull();
  });

  it('allows matching role', () => {
    useAuthStore.setState({
      user: { id: '1', email: 'a@b.com', name: 'Admin', role: 'ADMIN', createdAt: '' },
      accessToken: 'token',
      isAuthenticated: true,
    });
    renderWithRouter('/protected', ['ADMIN']);
    expect(screen.getByTestId('protected-content')).toBeTruthy();
  });
});
