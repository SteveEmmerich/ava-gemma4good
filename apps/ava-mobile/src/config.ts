export const config = {
  vibebaseIdentityUrl:
    process.env.EXPO_PUBLIC_VIBEBASE_IDENTITY_URL ??
    process.env.VIBEBASE_IDENTITY_URL ??
    "https://identity.vibebase.app",
  vibebaseGatewayUrl:
    process.env.EXPO_PUBLIC_VIBEBASE_GATEWAY_URL ??
    process.env.VIBEBASE_GATEWAY_URL ??
    "https://gateway.vibebase.app",
  avaBrainUrl: process.env.EXPO_PUBLIC_AVA_BRAIN_URL ?? "http://localhost:8787",
  clerkPublishableKey:
    process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ??
    "pk_test_aW5maW5pdGUtc2hlcGhlcmQtNjIuY2xlcmsuYWNjb3VudHMuZGV2JA"
};
