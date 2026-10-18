import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import LiveApp from "./src/live/LiveApp";
import { UpdateProvider } from "./src/live/UpdateManager";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 15000 }, mutations: { retry: false } },
});
export default function App() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <UpdateProvider>
          <LiveApp />
        </UpdateProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
