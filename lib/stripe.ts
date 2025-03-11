'use server'

import Stripe from 'stripe'
import { headers } from 'next/headers'

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
  productDescription: string,
  mock: boolean,
}

export async function createCheckoutSession(params: CheckoutParams) {
  const { productName, productPriceInCents, productDescription, mock } = params
  if (mock) return '/payment-success'

  if (!stripe) {
    throw new Error("Stripe is not initialized")
  }

  try {
    const baseUrl = (await headers()).get('origin')

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
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
      success_url: `${baseUrl}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/payment-failure?session_id={CHECKOUT_SESSION_ID}`,
    })

    return session.url
  } catch (error) {
    console.error("Error creating checkout session:", error)
    throw new Error("Failed to create checkout session")
  }
}

export async function retrieveCheckoutSession(sessionId: string) {
  if (!stripe) {
    throw new Error("Stripe is not initialized")
  }

  const session = await stripe.checkout.sessions.retrieve(sessionId)
  console.log(session)
  return {
    status: session.status,
    paymentStatus: session.payment_status,
  }
}
