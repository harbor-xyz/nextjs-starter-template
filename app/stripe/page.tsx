'use client'

import { createCheckoutSession } from '@/lib/stripe'
import { useRouter } from 'next/navigation'

export default function Page() {
  const router = useRouter()

  async function handleClick() {
    const url = await createCheckoutSession({
      productName: 'Pro Plan',
      productDescription: 'This is a pro plan',
      productPriceInCents: 2000,
    })
    if (url) {
      router.push(url)
    }
  }

  return (
    <div>
      <button onClick={handleClick}>Purchase Plan</button>
    </div>
  )
}
