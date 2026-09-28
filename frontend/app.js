import { current, saveSession, signOut, request } from "./api.js";
import { h, brand, notice, field, formAction } from "./ui.js";
import { appointments, appointment, newAppointment } from "./appointments.js";
import { recordVisit, visit } from "./visits.js";
import { bill } from "./billing.js";

const root = document.getElementById("app");
function navigate(path, message) {
  history.pushState(null, "", path);
  return render(message);
}
function login(message) {
  const username = field("Username", "username", {
    autocomplete: "username",
    required: true,
  });
  const password = field("Password", "password", {
    type: "password",
    autocomplete: "current-password",
    required: true,
  });
  const messages = h("div");
  if (message) messages.append(notice(message, true));
  const form = h("form", {}, username.node, password.node);
  formAction(
    form,
    "Sign in",
    async () => {
      try {
        const session = await request("customer", "/auth/login", {
          method: "POST",
          body: {
            username: username.input.value,
            password: password.input.value,
          },
        });
        saveSession(session);
        await navigate("/appointments");
      } catch (error) {
        password.input.value = "";
        messages.replaceChildren(
          notice(
            error.status === 401
              ? "Username or password is incorrect."
              : "We couldn't load this information. Try again.",
            true,
          ),
        );
      }
    },
    (error) => messages.replaceChildren(notice(error.message, true)),
  );
  root.replaceChildren(
    h(
      "main",
      { class: "login" },
      h(
        "div",
        { class: "login-panel" },
        h(
          "section",
          { class: "login-intro", "aria-label": "Clinic introduction" },
          brand(),
          h(
            "div",
            {},
            h("div", { class: "eyebrow" }, "CARE THAT FEELS PERSONAL"),
            h("h1", {}, "Good care,", h("br"), "every step."),
            h("p", {}, "Your pet's care, in one place."),
          ),
          h("p", { class: "small" }, "Demonstration clinic"),
        ),
        h(
          "section",
          { class: "login-form", "aria-labelledby": "sign-in-heading" },
          h("h2", { id: "sign-in-heading" }, "Sign in"),
          h("p", { class: "muted" }, "Welcome back to Cedar & Paw."),
          messages,
          form,
          h("p", { class: "login-note" }, "For customers and veterinarians."),
        ),
      ),
    ),
  );
  form.querySelector("button").className = "wide";
}

async function render(message) {
  if (!current()) {
    if (location.pathname !== "/") history.replaceState(null, "", "/");
    login(message);
    return;
  }
  if (location.pathname === "/")
    history.replaceState(null, "", "/appointments");
  const user = current().user;
  const main = h("main", { class: "main" });
  const messages = h("div");
  const content = h("div");
  const heading = h("header", { class: "page-heading" });
  main.append(
    h(
      "div",
      { class: "eyebrow muted" },
      user.role === "customer" ? "CUSTOMER PORTAL" : "VETERINARIAN WORKSPACE",
    ),
    heading,
    messages,
    content,
  );
  root.replaceChildren(
    h(
      "div",
      { class: "app" },
      h(
        "aside",
        { class: "sidebar" },
        brand(),
        h(
          "nav",
          { "aria-label": "Main" },
          h(
            "a",
            {
              class: "nav-link",
              "aria-current": "page",
              href: "/appointments",
            },
            "Appointments",
          ),
        ),
        h(
          "div",
          { class: "identity" },
          h("p", {}, user.displayName),
          h("p", {}, user.role === "customer" ? "Customer" : "Veterinarian"),
          h("a", { href: "/", "data-signout": "true" }, "Sign out"),
        ),
      ),
      main,
    ),
  );
  const ctx = {
    user,
    content,
    navigate,
    title(title, description, action) {
      heading.replaceChildren(
        h(
          "div",
          {},
          h("h1", {}, title),
          description && h("p", { class: "muted" }, description),
        ),
        ...(action ? [action] : []),
      );
      document.title = `${title} · Cedar & Paw`;
    },
    say(text, error = false) {
      messages.replaceChildren(notice(text, error));
    },
    report(error) {
      if (error.validation) {
        ctx.say(error.message, true);
        return;
      }
      if (error.status === 401) {
        signOut();
        navigate("/", "Your session has expired. Please sign in again.");
        return;
      }
      const text = {
        403: "You don't have permission to do that.",
        404: "This record is unavailable.",
        409: "This appointment or bill has changed. Review its current status.",
      }[error.status];
      ctx.say(text ?? "We couldn't load this information. Try again.", true);
      if (!text)
        messages.append(
          h("button", { type: "button", onclick: () => render() }, "Try again"),
        );
    },
  };
  content.append(h("p", { role: "status" }, "Loading…"));
  const parts = location.pathname.split("/").filter(Boolean);
  try {
    if (parts[0] === "appointments" && parts[1] === "new")
      await newAppointment(ctx);
    else if (parts[0] === "appointments" && parts[2] === "visit")
      await recordVisit(ctx, parts[1]);
    else if (parts[0] === "appointments" && parts[1])
      await appointment(ctx, parts[1]);
    else if (parts[0] === "appointments") await appointments(ctx);
    else if (parts[0] === "visits") await visit(ctx, parts[1]);
    else if (parts[0] === "bills") await bill(ctx, parts[1]);
    else {
      content.replaceChildren();
      ctx.say("This record is unavailable.", true);
    }
    content.querySelector('p[role="status"]')?.remove();
    if (message) ctx.say(message);
  } catch (error) {
    content.replaceChildren();
    ctx.report(error);
  }
}
document.addEventListener("click", (event) => {
  const link = event.target.closest("a[href]");
  if (
    !link ||
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  )
    return;
  const url = new URL(link.href);
  if (url.origin !== location.origin) return;
  event.preventDefault();
  if (link.dataset.signout) signOut();
  navigate(url.pathname);
});
addEventListener("popstate", () => render());
await render();
