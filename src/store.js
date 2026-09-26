const originalPets = [
  {
    id: 1,
    name: "Leo",
    species: "Cat",
    owner: "George Franklin",
    visits: []
  },
  {
    id: 2,
    name: "Rosy",
    species: "Dog",
    owner: "Betty Davis",
    visits: []
  }
];

let pets = structuredClone(originalPets);

export function listPets() {
  return structuredClone(pets);
}

export function findPet(id) {
  return pets.find((pet) => pet.id === Number(id));
}

export function addVisit(petId, visit) {
  const pet = findPet(petId);
  if (!pet) {
    return { status: 404, error: "Pet not found" };
  }

  const duplicate = pet.visits.some((item) => item.date === visit.date);
  if (duplicate) {
    return {
      status: 409,
      error: "A visit is already scheduled for this date"
    };
  }

  const savedVisit = {
    id: pet.visits.length + 1,
    date: visit.date,
    description: visit.description
  };
  pet.visits.push(savedVisit);
  return { status: 201, visit: structuredClone(savedVisit) };
}

export function resetStore() {
  pets = structuredClone(originalPets);
}
