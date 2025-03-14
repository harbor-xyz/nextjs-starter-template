import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "../client";

export async function POST(req: NextRequest) {
  try {
    const { productName, productPriceInCents, productDescription, mock } =
      await req.json();

    if (mock) {
      return NextResponse.json({ url: "/payment-success" });
    }

    const baseUrl = req.headers.get("origin");
    const stripe = getStripe()
    
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: productName, description: productDescription },
            unit_amount: productPriceInCents,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${baseUrl}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/payment-failure?session_id={CHECKOUT_SESSION_ID}`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}