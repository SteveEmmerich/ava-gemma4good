import { Stack } from "expo-router/stack";
import { ClerkProvider } from "@clerk/clerk-expo";
import { config } from "../src/config";
import { clerkTokenCache } from "../src/storage/clerk-token-cache";

export default function RootLayout() {
  return (
    <ClerkProvider publishableKey={config.clerkPublishableKey} tokenCache={clerkTokenCache}>
      <Stack>
        <Stack.Screen name="index" options={{ title: "Ava" }} />
      </Stack>
    </ClerkProvider>
  );
}
