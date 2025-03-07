'use server'

import { headers } from 'next/headers'
import Stripe from 'stripe'

function getEnvVariable(key: string): string {
  const value = process.env[key]
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`)
  }
  return value
}

let stripe: Stripe | null = null
try {
  const stripeSecretKey = getEnvVariable("STRIPE_SECRET_KEY")
  stripe = new Stripe(stripeSecretKey, {
    apiVersion: "2025-02-24.acacia",
  })
} catch (error) {
  console.error("Failed to initialize Stripe:", error)
}

type CheckoutParams = {
  productName: string
  productPriceInCents: number
  productDescription: string
}

export async function createCheckoutSession(params: CheckoutParams): Promise<string> {
  const { productName, productPriceInCents, productDescription } = params

  if (!stripe) {
    throw new Error("Stripe is not initialized")
  }

  try {
    const origin = (await headers()).get('origin')

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      ui_mode: 'embedded',
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: productName,
              description: productDescription,
            },
            unit_amount: productPriceInCents,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      return_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
    })

    console.log(session)

    if (!session.client_secret) {
      throw new Error("No client secret found")
    }

    return session.client_secret
  } catch (error) {
    console.error("Error creating checkout session:", error)
    throw new Error("Failed to create checkout session")
  }
}
