import { NextResponse } from "next/server";

type NotificationRequest = {
  to?: string;
  subject?: string;
  message?: string;
  event?: "stream_created" | "stream_completed" | "stream_canceled" | "ready_to_claim";
};

export async function POST(req: Request) {
  try {
    const body = await req.json() as NotificationRequest;

    if (!body.to || !body.subject || !body.message) {
      return NextResponse.json({ error: "Email, subject, and message are required" }, { status: 400 });
    }

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({
        configured: false,
        queued: false,
        event: body.event ?? "stream_created",
        message: "Email provider is not configured. Add RESEND_API_KEY to enable outbound notifications.",
      });
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.NOTIFICATION_FROM_EMAIL ?? "Arc Drift <onboarding@resend.dev>",
        to: body.to,
        subject: body.subject,
        text: body.message,
      }),
    });
    const data = await response.json() as { id?: string; message?: string };

    if (!response.ok) {
      return NextResponse.json({ error: data.message ?? "Notification provider rejected the email" }, { status: 502 });
    }

    return NextResponse.json({
      configured: true,
      queued: true,
      id: data.id,
      event: body.event ?? "stream_created",
    });
  } catch (error: unknown) {
    console.error("Notification Error:", error);
    return NextResponse.json({ error: "Failed to process notification" }, { status: 500 });
  }
}
