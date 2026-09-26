import express from "express";
import { addVisit, findPet, listPets, resetStore } from "./store.js";

export function createApp({ enableTestRoutes = false } = {}) {
  const app = express();

  app.use(express.json());
  app.use(express.static(new URL("../public", import.meta.url).pathname));

  app.get("/api/pets", (_request, response) => {
    response.json(listPets());
  });

  app.get("/api/pets/:petId", (request, response) => {
    const pet = findPet(request.params.petId);
    if (!pet) {
      return response.status(404).json({ error: "Pet not found" });
    }
    return response.json(pet);
  });

  app.post("/api/pets/:petId/visits", (request, response) => {
    const { date, description } = request.body;
    if (!date || !description) {
      return response.status(400).json({
        error: "Date and description are required"
      });
    }

    const result = addVisit(request.params.petId, { date, description });
    if (result.error) {
      return response.status(result.status).json({ error: result.error });
    }
    return response.status(result.status).json(result.visit);
  });

  if (enableTestRoutes) {
    app.post("/api/test/reset", (_request, response) => {
      resetStore();
      response.status(204).send();
    });
  }

  return app;
}
