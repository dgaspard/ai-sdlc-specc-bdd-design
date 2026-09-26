import { createApp } from "../../src/app.js";

export async function startTestServer() {
  const server = createApp({ enableTestRoutes: true }).listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const address = server.address();

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    })
  };
}

export async function seedVisit(baseUrl) {
  const response = await fetch(`${baseUrl}/api/pets/1/visits`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      date: "2026-10-10",
      description: "Annual checkup"
    })
  });

  if (response.status !== 201) {
    throw new Error(`Unable to seed visit: received HTTP ${response.status}`);
  }
}
