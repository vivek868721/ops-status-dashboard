import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchMe, apiLogin, apiLogout } from "../lib/api";

export function useAuth() {
  const queryClient = useQueryClient();

  const { data: user, isLoading, isError } = useQuery({
    queryKey: ["me"],
    queryFn: fetchMe,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  async function login(email: string, password: string) {
    await apiLogin(email, password);
    await queryClient.invalidateQueries({ queryKey: ["me"] });
  }

  async function logout() {
    await apiLogout();
    queryClient.setQueryData(["me"], null);
  }

  return { user: user ?? null, isLoading, isError, login, logout };
}
