export async function fetchExperienceConfig({ fetchFn = fetch } = {}) {
  const response = await fetchFn("/api/experience-config", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Experience config request failed: ${response.status}`);
  }
  return response.json();
}
