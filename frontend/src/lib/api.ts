import axios from "axios"

const api = axios.create({
  baseURL:  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
})

// Automatically attach Idempotency-Key to POST requests
api.interceptors.request.use((config) => {
  if (config.method === "post") {
    config.headers["Idempotency-Key"] = crypto.randomUUID()
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error.response &&
      error.response.status === 404 &&
      error.response.data?.detail === "User not found"
    ) {
      localStorage.removeItem("guardpay_user")
      window.location.href = "/auth/login"
    }

    return Promise.reject(error)
  }
)

export default api
