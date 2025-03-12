'use client'

import { createCheckoutSessionServer } from "./server"
import { CheckoutParams } from "./type"

export async function createCheckoutSession(params: CheckoutParams) {
  const isInIframe = window.self !== window.top
  return createCheckoutSessionServer({ ...params, mock: isInIframe })
}
