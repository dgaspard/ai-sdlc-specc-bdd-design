import { setWorldConstructor } from "@cucumber/cucumber";

class PetClinicWorld {
  context = undefined;
  page = undefined;
}

setWorldConstructor(PetClinicWorld);
