export type CheckoutParams = {
  productName: string
  productPriceInCents: number
  productDescription: string,
}

export type CheckoutParamsServer = CheckoutParams & {
  mock: boolean
}
