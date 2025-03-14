import Stripe from "stripe";

let stripe: Stripe | null = null

export function getStripe() {
  if (stripe !== null) {
    return stripe
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    throw new Error("Missing environment variable: STRIPE_SECRET_KEY");
  }

  stripe = new Stripe(stripeSecretKey, {
    apiVersion: "2025-02-24.acacia",
  });
  return stripe
}
