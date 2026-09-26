const petList = document.querySelector("#pet-list");
const petSelect = document.querySelector("#pet");
const form = document.querySelector("#visit-form");
const message = document.querySelector("#message");

async function loadPets() {
  const response = await fetch("/api/pets");
  const pets = await response.json();

  petList.replaceChildren(
    ...pets.map((pet) => {
      const card = document.createElement("article");
      card.className = "pet-card";
      card.dataset.testid = `pet-${pet.id}`;
      card.innerHTML = `
        <div class="pet-avatar" aria-hidden="true">${pet.species === "Cat" ? "C" : "D"}</div>
        <div>
          <h3>${pet.name}</h3>
          <p>${pet.species} · ${pet.owner}</p>
          <small>${pet.visits.length} scheduled visit${pet.visits.length === 1 ? "" : "s"}</small>
        </div>
      `;
      return card;
    })
  );

  petSelect.replaceChildren(
    ...pets.map((pet) => {
      const option = document.createElement("option");
      option.value = pet.id;
      option.textContent = `${pet.name} (${pet.owner})`;
      return option;
    })
  );
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  message.className = "";
  message.textContent = "Scheduling…";

  const data = new FormData(form);
  const response = await fetch(`/api/pets/${data.get("petId")}/visits`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      date: data.get("date"),
      description: data.get("description")
    })
  });
  const body = await response.json();

  if (!response.ok) {
    message.className = "error";
    message.textContent = body.error;
    return;
  }

  message.className = "success";
  message.textContent = "Visit scheduled successfully";
  form.reset();
  await loadPets();
});

await loadPets();
