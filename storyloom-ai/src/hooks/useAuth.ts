import { useAuthStore } from '../store/authStore';

export function useAuth() {
  const { user, isLoggedIn, login, logout } = useAuthStore();
  return { user, isLoggedIn, login, logout };
}
