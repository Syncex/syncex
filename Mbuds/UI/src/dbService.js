
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
const endpoints = {
  dashboard: '/moodbudsv1/dashboard',
  bluetooth: '/moodbudsv1/bluetooth',
}
async function getMentalState(data) {
  const url = `${API_BASE_URL}${endpoints.bluetooth}`;
  try {
    const response = await fetch(url, {
      credentials: 'include',
      method: "POST",
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json' },
    }
    )
    const contentType = response.headers.get("content-type") || ' ';
    const payload = contentType.includes('application/json');
    if (!response.ok) {
      throw new Error(payload.message || 'Something went wrong.Please try again');
    }
    const mood = await response.json();
    console.log(JSON.parse(mood));
    return mood;
  }
  catch (error) {
    throw new Error(`We are encountering some errors${error}`)
  }
}
export const dbService = {
  getMentalState
}

