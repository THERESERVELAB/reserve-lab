import OpenAI from "openai";

import { serverEnv } from "@/lib/env/server";

export function createOpenAIClient() {
  if (!serverEnv.OPENAI_API_KEY) {
    return null;
  }

  return new OpenAI({
    apiKey: serverEnv.OPENAI_API_KEY,
  });
}
