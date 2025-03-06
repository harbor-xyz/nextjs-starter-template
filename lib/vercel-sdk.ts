import {
  generateText,
  experimental_generateImage as generateImage,
  Experimental_GeneratedImage,
} from "ai";
// import all vercel ai providers
import { createOpenAI } from "@ai-sdk/openai";
import dotenv from "dotenv";

// what is dirname?
console.log(__dirname);
// what are the envs?
console.log("PROCESS ENV BEFORE CONFIG");
console.log(process.env);

dotenv.config();

console.log("PROCESS ENV AFTER CONFIG");

const openAiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;

console.log("OPEN AI KEY");
console.log(openAiKey);

const openai = createOpenAI({
  apiKey: openAiKey,
});

// next we have to get the correct API keys for each provider
// we should do this using a secrets manager

export const SUPPORTED_IMAGE_GENERATION_MODELS = {
  openai: ["dall-e-2", "dall-e-3"],
} as const;

export const SUPPORTED_IMAGE_SIZES_PER_MODEL = {
  openai: ["1024x1024", "1792x1024", "1024x1792"],
} as const;
// Define supported models for each provider
export const SUPPORTED_TEXT_GENERATION_MODELS = {
  openai: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-4"],
} as const;

export type Provider = "openai";

export type ImageModelName = "dall-e-2" | "dall-e-3";

export type ImageProvider = "openai";

export type ModelName = "gpt-4o" | "gpt-4o-mini" | "gpt-4-turbo" | "gpt-4";
export interface GenerateTextOptions<T extends Provider> {
  provider: Provider;
  model: ModelName;
  prompt: string;
  temperature?: number;
  maxTokens?: number;
}

export interface GenerateImageOptions<T extends Provider> {
  provider: ImageProvider;
  model: ImageModelName;
  prompt: string;
  seed?: number;
  size?: "1024x1024" | "1792x1024" | "1024x1792";
  n?: 1 | 2 | 3 | 4;
}

export async function genericGenerateImage<T extends ImageProvider>({
  provider,
  model,
  prompt,
  seed,
  size,
  n,
}: GenerateImageOptions<T>): Promise<Experimental_GeneratedImage[]> {
  // first check to see if the provider and model can generate images
  if (
    !(
      SUPPORTED_IMAGE_GENERATION_MODELS[provider] as readonly string[]
    ).includes(model)
  ) {
    throw new Error(
      `Unsupported model "${model}" for provider "${provider} for Image Generation".`
    );
  }

  // now check to see if the size is supported for the model
  if (
    !(SUPPORTED_IMAGE_SIZES_PER_MODEL[provider] as readonly string[]).includes(
      size ?? ""
    )
  ) {
    throw new Error(
      `Unsupported size "${size}" for model "${model}" for provider "${provider} for Image Generation".`
    );
  }

  // now make the call to the provider

  let providerInstance;

  switch (provider) {
    case "openai":
      providerInstance = openai;
      break;
  }

  try {
    const { images } = await generateImage({
      model: providerInstance.image(model),
      prompt: prompt,
      n,
      size,
    });

    return images;
  } catch (error) {
    console.error(`Error generating image with ${provider}:`, error);
    throw error;
  }
}

export async function genericGenerateText<T extends Provider>({
  provider,
  model,
  prompt,
  temperature = 0.5,
  maxTokens = 1000,
}: GenerateTextOptions<T>): Promise<string> {
  // Check if model is supported for the provider
  if (
    !(SUPPORTED_TEXT_GENERATION_MODELS[provider] as readonly string[]).includes(
      model
    )
  ) {
    throw new Error(
      `Unsupported model "${model}" for provider "${provider}" for Text Generation. Supported models are: ${SUPPORTED_TEXT_GENERATION_MODELS[
        provider
      ].join(", ")}`
    );
  }

  let providerInstance;

  switch (provider) {
    case "openai":
      providerInstance = openai;
      break;
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }

  try {
    console.log("MAKING GENERATE TEXT CALL");
    const { text } = await generateText({
      model: providerInstance(model),
      prompt: prompt,
      temperature,
      maxTokens,
    });
    console.log("GETTING BACK TEXT");
    console.log(text);

    return text;
  } catch (error) {
    console.error(`Error generating text with ${provider}:`, error);
    throw error;
  }
}
