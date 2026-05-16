import { Hono } from "hono"
import { cors } from "hono/cors"
import { validateEmail } from "./validate"

const MAX_EMAIL_LENGTH = 254

const app = new Hono()

app.use("*", cors())

app.get("/validate", async (c) => {
  const email = c.req.query("email")
  if (!email || email.length > MAX_EMAIL_LENGTH) {
    return c.json({ error: "Missing or invalid 'email' query parameter (max 254 chars)" }, 400)
  }

  const result = await validateEmail(email)
  return c.json(result)
})

app.get("/health", (c) => c.json({ status: "ok" }))

app.all("*", (c) => c.json({ error: "Not found" }, 404))

export default app
