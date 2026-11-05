export const dynamic = "force-dynamic";
export function GET() {
  return Response.json({
    liveAvailable: Boolean(process.env.OPENAI_API_KEY?.trim()),
    demoAvailable: process.env.ENABLE_DEMO !== "false",
  }, { headers: { "Cache-Control": "no-store" } });
}
