import { Given, Then, When } from "@cucumber/cucumber";
import { expect } from "@playwright/test";
import { runtime } from "../support/runtime.js";

async function selectPet(page, petName) {
  const option = page.locator("#pet option").filter({ hasText: petName });
  await page.locator("#pet").selectOption(await option.getAttribute("value"));
}

Given("the PetClinic is open", async function () {
  await this.page.goto(runtime.baseUrl);
  await expect(this.page.getByRole("heading", { name: "PetClinic" })).toBeVisible();
});

Given(
  "{string} has a visit on {string} for {string}",
  async function (petName, date, description) {
    const pets = await (await fetch(`${runtime.baseUrl}/api/pets`)).json();
    const pet = pets.find((item) => item.name === petName);
    await fetch(`${runtime.baseUrl}/api/pets/${pet.id}/visits`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, description })
    });
    await this.page.reload();
  }
);

When(
  "I schedule a visit for {string} on {string} for {string}",
  async function (petName, date, description) {
    await selectPet(this.page, petName);
    await this.page.getByLabel("Visit date").fill(date);
    await this.page.getByLabel("Reason for visit").fill(description);
    await this.page.getByRole("button", { name: "Schedule visit" }).click();
  }
);

When("I cancel the visit for {string} on {string}", async function (petName, date) {
  const cancelButton = this.page.getByRole("button", {
    name: `Cancel ${petName}'s visit on ${date}`
  });
  await expect(
    cancelButton,
    "the visit must expose an accessible cancellation control"
  ).toBeVisible({ timeout: 2_000 });
  await cancelButton.click();
});

Then("I should see the patient {string}", async function (petName) {
  await expect(this.page.getByRole("heading", { name: petName })).toBeVisible();
});

Then("I should see {string}", async function (message) {
  await expect(this.page.getByRole("status")).toHaveText(message);
});

Then(/^"([^"]+)" should have (\d+) scheduled visits?$/, async function (petName, countText) {
  const count = Number(countText);
  const card = this.page.locator("article", { has: this.page.getByRole("heading", { name: petName }) });
  await expect(card.getByText(`${count} scheduled visit`, { exact: false })).toBeVisible();
});
