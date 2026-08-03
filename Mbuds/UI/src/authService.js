const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

const endpoints = {
  signup: '/moodbudsv1/signup',
  verifyOtp: '/moodbudsv1/verifyotp',
  createProfile: '/moodbudsv1/profilecreation',
  signin: '/moodbudsv1/signin',
}
async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: 'include',
    ...options,
  })

  const contentType = response.headers.get('content-type') || ''
  const payload = contentType.includes('application/json') ? await response.json() : { message: response.ok ? 'Success' : 'Something went wrong' }

  if (!response.ok) {
    throw new Error(payload.message || 'Something went wrong. Please try again.')
  }
  return payload
}

export const authService = {
  signup(data) {
    return request(endpoints.signup, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
  },

  verifyOtp(otp) {
    return request(endpoints.verifyOtp, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ otp }),
    })
  },

  createProfile({ nickname, password, image }) {
    const formData = new FormData()
    formData.append('nickname', nickname)
    formData.append('password', password)
    if (image) formData.append('image', image)

    return request(endpoints.createProfile, {
      method: 'POST',
      body: formData,
    })
  },

  signin(data) {
    return request(endpoints.signin, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
  },
}
