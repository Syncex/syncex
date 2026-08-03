const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

async function getMentalState(data) {
  const response = await fetch(`${API_BASE_URL}/moodbudsv1/bluetooth`, {
    credentials: "include",
    method: "POST",
    body: JSON.stringify(data),
    headers: { "Content-Type": "application/json" },
  });
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : await response.text();

  if (!response.ok) {
    const message = typeof payload === "object" && payload?.message ? payload.message : "Unable to process this reading.";
    throw new Error(message);
  }
  if (typeof payload === "string") {
    try { return JSON.parse(payload); } catch { return { state: payload }; }
  }
  return payload;
}

export const dbService = { getMentalState };
