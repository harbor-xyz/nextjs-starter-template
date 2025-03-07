'use client'

import { loadStripe } from '@stripe/stripe-js'
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from '@stripe/react-stripe-js'
import { createCheckoutSession } from "@/lib/stripe-embedded"

function getStripePublishableKey(): string {
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  if (!key) {
    throw new Error('Missing environment variable: NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY')
  }
  return key
}

const stripePromise = loadStripe(getStripePublishableKey())

type StripeFormProps = {
    productName: string;
    productDescription: string;
    productPriceInCents: number;
  }

export function StripeForm({ productName, productDescription, productPriceInCents }: StripeFormProps) {
  async function createCheckout() {
    return createCheckoutSession({
      productName,
      productDescription,
      productPriceInCents,
    })
  }

  return (
    <div id="checkout">
      <EmbeddedCheckoutProvider
        stripe={stripePromise}
        options={{ fetchClientSecret: createCheckout }}
      >
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  )
}
