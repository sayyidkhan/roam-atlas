import {
  UsageResponseSchema,
  type UsageResponse
} from "@roamatlas/contracts/usageContract.js";

export async function fetchUsage(): Promise<UsageResponse> {
  const response = await fetch("/api/usage", {
    headers: { Accept: "application/json" }
  });
  if (!response.ok) {
    throw new Error(`Usage request failed: ${response.status}`);
  }
  return UsageResponseSchema.parse(await response.json());
}
