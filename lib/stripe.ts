export type CheckoutParams = {
  productName: string
  productPriceInCents: number
  productDescription: string,
}

export async function createCheckoutSession(params: CheckoutParams) {
  const isInIframe = window.self !== window.top;
  const response = await fetch("/api/stripe/create-checkout-session", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ...params, mock: isInIframe }),
  });

  if (!response.ok) {
    throw new Error("Failed to create checkout session");
  }

  const { url } = await response.json();
  return url;
}

export async function retrieveCheckoutSession(sessionId: string) {
  const response = await fetch(`/api/stripe/retrieve-checkout-session?session_id=${sessionId}`);

  if (!response.ok) {
    throw new Error("Failed to retrieve checkout session");
  }

  return response.json();
}
