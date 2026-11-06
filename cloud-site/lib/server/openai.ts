import "server-only";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { mentorDraftSchema, type MentorDraft, type MentorRequest } from "../contracts";
import { buildStudentEnvelope, REVIEW_POLICY, policyForLocale } from "./policy";

// server-only rejects accidental imports across the client boundary at build time.
function client() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 20_000, maxRetries: 0 });
}
const model = () => process.env.OPENAI_MODEL || "gpt-4.1-mini";
export async function generate(input: MentorRequest, hintLevel: number, signal: AbortSignal) {
  const response = await client().responses.parse({
    model: model(), store: false, max_output_tokens: 900,
    input: [
      { role: "system", content: policyForLocale(input.locale) },
      { role: "user", content: buildStudentEnvelope(input, hintLevel) },
    ],
    text: { format: zodTextFormat(mentorDraftSchema, "mentor_question") },
  }, { signal });
  return response.output_parsed;
}
export async function review(input: MentorRequest, candidate: MentorDraft, signal: AbortSignal) {
  const response = await client().responses.parse({
    model: model(), store: false, max_output_tokens: 150,
    input: [
      { role: "system", content: REVIEW_POLICY },
      { role: "user", content: JSON.stringify({ untrusted_student_data: input, candidate }) },
    ],
    text: { format: zodTextFormat(z.object({ safe: z.boolean() }).strict(), "spoiler_review") },
  }, { signal });
  return response.output_parsed?.safe === true;
}
