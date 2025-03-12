'use client'

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { retrieveCheckoutSession } from "@/lib/stripe/server";

export default function Page() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');

  const [status, setStatus] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);

  useEffect(() => {
    if (sessionId) {
      retrieveCheckoutSession(sessionId).then((data) => {
        setStatus(data.status)
        setPaymentStatus(data.paymentStatus)
      });
    }
  }, [sessionId]);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        backgroundColor: "green",
      }}
    >
      <div style={{ margin: "auto" }}>
        <div style={{ fontSize: "60px", color: "white" }}>Payment Success</div>
        <div>Status: {status}</div>
        <div>Payment Status: {paymentStatus}</div>
      </div>
    </div>
  );
}