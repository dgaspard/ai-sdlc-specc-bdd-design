// All runtime values become text nodes or DOM properties, never HTML strings.
export function h(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
    else if (key === "class") node.className = value;
    else if (value !== false && value !== null && value !== undefined)
      node.setAttribute(key, value === true ? "" : String(value));
  }
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(
      child instanceof Node ? child : document.createTextNode(String(child)),
    );
  }
  return node;
}
export const money = (cents) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    cents / 100,
  );
export const date = (value) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
export const time = (value, zone = false) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    hour: "numeric",
    minute: "2-digit",
    ...(zone ? { timeZoneName: "short" } : {}),
  }).format(new Date(value));
export const fullName = (person) => `${person.firstName} ${person.lastName}`;
export const vetName = (person) => `Dr ${fullName(person)}`;
export function brand() {
  return h(
    "div",
    { class: "brand" },
    h("img", { src: "/design/assets/cedar-paw.svg", alt: "" }),
    h("div", {}, h("strong", {}, "Cedar & Paw"), h("span", {}, "VETERINARY")),
  );
}
export function notice(text, error = false) {
  return h(
    "div",
    {
      class: `notice${error ? " error" : ""}`,
      role: error ? "alert" : "status",
    },
    text,
  );
}
export function field(label, id, options = {}) {
  const { tag = "input", help, ...attrs } = options;
  const input = h(tag, {
    id,
    name: id,
    ...attrs,
    ...(help ? { "aria-describedby": `${id}-help` } : {}),
  });
  return {
    input,
    node: h(
      "div",
      { class: "field" },
      h("label", { for: id }, label),
      input,
      help && h("p", { id: `${id}-help`, class: "detail" }, help),
    ),
  };
}
export function paymentMethod(id, label) {
  const f = field(label, id, { tag: "select" });
  f.input.append(
    h("option", { value: "fake-card-approve" }, "Demo card — approve"),
    h("option", { value: "fake-card-decline" }, "Demo card — decline"),
  );
  return f;
}
export function servicesField(legend, services, selected = []) {
  return h(
    "fieldset",
    { class: "field" },
    h("legend", {}, legend),
    services.map((service) =>
      h(
        "label",
        {},
        h("input", {
          type: "checkbox",
          name: "services",
          value: service.id,
          checked: selected.includes(service.id),
        }),
        service.name,
      ),
    ),
  );
}
export function selections(form) {
  return [...form.querySelectorAll('input[name="services"]:checked')].map(
    (input) => input.value,
  );
}
export function invalid(form, input, message) {
  input.setAttribute("aria-invalid", "true");
  const id = `${input.id || input.name}-error`;
  form.querySelector(`#${id}`)?.remove();
  input.setAttribute("aria-describedby", id);
  input.after(
    h("p", { id, class: "small error", "data-field-error": "true" }, message),
  );
  input.focus();
}
export function formAction(form, label, action, report) {
  form.noValidate = true;
  const button = h("button", { type: "submit" }, label);
  form.append(button);
  let busy = false;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy) return;
    for (const input of form.querySelectorAll('[aria-invalid="true"]')) {
      input.removeAttribute("aria-invalid");
      input.removeAttribute("aria-describedby");
    }
    form
      .querySelectorAll("[data-field-error]")
      .forEach((node) => node.remove());
    const missing = [...form.querySelectorAll("[required]")].find(
      (input) => !input.value.trim(),
    );
    if (missing) {
      invalid(form, missing, "This field is required.");
      const error = new Error("Check the highlighted fields.");
      error.validation = true;
      report(error);
      return;
    }
    busy = true;
    button.disabled = true;
    button.textContent = label === "Pay now" ? "Processing…" : "Saving…";
    try {
      await action();
    } catch (error) {
      report(error);
    } finally {
      busy = false;
      button.disabled = false;
      button.textContent = label;
    }
  });
  return button;
}
