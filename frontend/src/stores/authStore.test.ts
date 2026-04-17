import { useAuthStore } from './authStore';

beforeEach(() => {
  useAuthStore.setState({
    user: null,
    accessToken: null,
    isAuthenticated: false,
  });
});

describe('authStore', () => {
  it('starts with unauthenticated state', () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it('setAuth sets user, token, and isAuthenticated', () => {
    const user = { id: '1', email: 'a@b.com', name: 'Test', role: 'PARTICIPANT' as const, createdAt: '' };
    useAuthStore.getState().setAuth(user, 'token-123');

    const state = useAuthStore.getState();
    expect(state.user).toEqual(user);
    expect(state.accessToken).toBe('token-123');
    expect(state.isAuthenticated).toBe(true);
  });

  it('setAccessToken updates only the token', () => {
    const user = { id: '1', email: 'a@b.com', name: 'Test', role: 'PARTICIPANT' as const, createdAt: '' };
    useAuthStore.getState().setAuth(user, 'old-token');
    useAuthStore.getState().setAccessToken('new-token');

    const state = useAuthStore.getState();
    expect(state.accessToken).toBe('new-token');
    expect(state.user).toEqual(user);
  });

  it('setUser updates only the user', () => {
    const user1 = { id: '1', email: 'a@b.com', name: 'Test', role: 'PARTICIPANT' as const, createdAt: '' };
    const user2 = { id: '1', email: 'a@b.com', name: 'Updated', role: 'HOST' as const, createdAt: '' };
    useAuthStore.getState().setAuth(user1, 'token');
    useAuthStore.getState().setUser(user2);

    expect(useAuthStore.getState().user?.name).toBe('Updated');
    expect(useAuthStore.getState().accessToken).toBe('token');
  });

  it('logout clears everything', () => {
    const user = { id: '1', email: 'a@b.com', name: 'Test', role: 'PARTICIPANT' as const, createdAt: '' };
    useAuthStore.getState().setAuth(user, 'token');
    useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });
});
