import {
  request,
  pendingPayment,
  rememberPayment,
  forgetPayment,
} from "./api.js";
import { referenceData, names } from "./appointments.js";
import {
  h,
  date,
  money,
  field,
  paymentMethod,
  formAction,
  invalid,
} from "./ui.js";

const attention =
  "Payment outcome needs attention. Do not start another payment until it is checked.";
function cents(value) {
  // Decimal strings are parsed without floating-point multiplication or rounding.
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(amount) ? amount : null;
}
export async function bill(ctx, id) {
  const checkout = await request("checkout", `/checkouts/${id}`);
  const [record, data] = await Promise.all([
    request("reservation", `/visits/${checkout.visitId}`),
    referenceData(ctx.user),
  ]);
  const reservation = await request(
    "reservation",
    `/reservations/${checkout.reservationId}`,
  );
  const n = names(record, data);
  const pending = pendingPayment(id);
  const paid = checkout.remainingBalance === 0 && !pending;
  ctx.title(
    "Visit bill",
    `${n.pet} · ${date(reservation.scheduledStart)} · ${n.vet}`,
    h(
      "span",
      { class: `badge${paid ? "" : " pending"}` },
      paid ? "Paid in full" : "Balance due",
    ),
  );
  const services = checkout.billedLines.reduce(
    (sum, line) => sum + line.priceAmount,
    0,
  );
  const bookingFee = checkout.totalAmount - services;
  const row = (label, amount, emphasis = false) =>
    h(
      "div",
      { class: emphasis ? "row rule" : "row small" },
      h(emphasis ? "strong" : "span", {}, label),
      h(emphasis ? "strong" : "span", {}, money(amount)),
    );
  const summary = h(
    "section",
    { class: "panel", "aria-labelledby": "summary-title" },
    h("h2", { id: "summary-title" }, "Bill summary"),
    row("Services", services),
    row("Booking fee", bookingFee),
    row("Total", checkout.totalAmount, true),
    row("Payments received", checkout.previouslyPaidAmount),
    row("Promotion", checkout.promotion?.appliedAmount ?? 0),
    h(
      "div",
      { class: "rule" },
      h("p", { class: "small muted" }, "Balance due"),
      h("p", { class: "balance" }, money(checkout.remainingBalance)),
    ),
    h(
      "p",
      { class: "detail rule" },
      `Your ${money(reservation.bookingFeePaid ? reservation.bookingFeeAmount : 0)} booking payment is already included in payments received.`,
    ),
  );
  const stack = h(
    "div",
    { class: "stack" },
    h(
      "section",
      { class: "panel" },
      h("h2", {}, "Services provided"),
      checkout.billedLines.map((line) =>
        h(
          "div",
          { class: "row" },
          h("span", {}, line.description),
          h("strong", {}, money(line.priceAmount)),
        ),
      ),
      h(
        "p",
        { class: "muted small rule" },
        "Your bill includes the services recorded for this visit.",
      ),
    ),
  );
  if (
    ctx.user.role === "customer" &&
    (pending || checkout.remainingBalance > 0)
  ) {
    const panel = h(
      "section",
      { class: "panel" },
      h("h2", {}, "Make a payment"),
      h(
        "p",
        { class: "muted small" },
        "Pay all or part of your remaining balance.",
      ),
    );
    const form = h("form");
    const amount = field("Payment amount", "amount", {
      inputmode: "decimal",
      value: (checkout.remainingBalance / 100).toFixed(2),
      "aria-describedby": "amount-help",
    });
    amount.node.classList.add("rule");
    amount.node.append(
      h(
        "p",
        { class: "detail", id: "amount-help" },
        `USD · Up to ${money(checkout.remainingBalance)}`,
      ),
    );
    const method = paymentMethod("method", "Payment method");
    if (!pending) form.append(amount.node, method.node);
    else
      ctx.say(
        `${attention}${pending.attemptId ? ` Reference: ${pending.attemptId}` : ""}`,
        true,
      );
    formAction(
      form,
      pending ? "Retry same payment" : "Pay now",
      async () => {
        let intent = pendingPayment(id);
        if (!intent) {
          const value = cents(amount.input.value.trim());
          if (
            value === null ||
            value <= 0 ||
            value > checkout.remainingBalance
          ) {
            invalid(
              form,
              amount.input,
              `Enter a positive amount up to ${money(checkout.remainingBalance)}, with at most two decimal places.`,
            );
            ctx.say("Check the highlighted fields.", true);
            return;
          }
          intent = {
            key: crypto.randomUUID(),
            body: { amount: value, mockMethodReference: method.input.value },
          };
          // Persist before sending; storage failure stops the write rather than losing its identity.
          rememberPayment(id, intent);
        }
        try {
          const result = await request(
            "checkout",
            `/checkouts/${id}/payments`,
            { method: "POST", key: intent.key, body: intent.body },
          );
          forgetPayment(id);
          await bill(ctx, id);
          ctx.say(
            result.attempt.outcome === "declined"
              ? "Payment was declined. Your balance has not changed."
              : "Payment received.",
            result.attempt.outcome === "declined",
          );
        } catch (error) {
          if (!error.status || error.status >= 500) {
            rememberPayment(id, {
              ...intent,
              ...(error.body?.paymentAttemptId
                ? { attemptId: error.body.paymentAttemptId }
                : {}),
            });
            // Do not infer settlement from a zero GET balance after an uncertain write.
            await bill(ctx, id);
          } else {
            forgetPayment(id);
            if (error.status === 409) await bill(ctx, id);
            ctx.report(error);
          }
        }
      },
      (error) => {
        ctx.say(attention, true);
        if (error.status === 401) ctx.report(error);
      },
    );
    panel.append(form);
    stack.append(panel);
  }
  ctx.content.replaceChildren(h("div", { class: "columns" }, stack, summary));
}
