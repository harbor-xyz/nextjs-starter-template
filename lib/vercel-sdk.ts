import {
  generateText,
  experimental_generateImage as generateImage,
  Experimental_GeneratedImage,
} from "ai";
// import all vercel ai providers
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";

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
  anthropic: ["claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022"],
} as const;

export type Provider = "openai" | "anthropic";

export type ImageModelName = "dall-e-2" | "dall-e-3";

export type ImageProvider = "openai";

export type ModelName =
  | "gpt-4o"
  | "gpt-4o-mini"
  | "gpt-4-turbo"
  | "gpt-4"
  | "claude-3-5-sonnet-20241022"
  | "claude-3-5-haiku-20241022";
export interface GenerateTextOptions<T extends Provider> {
  provider: Provider;
  model: ModelName;
  prompt: string;
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
    case "anthropic":
      providerInstance = anthropic;
      break;
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }

  try {
    const { text } = await generateText({
      model: providerInstance(model),
      prompt: prompt,
    });

    return text;
  } catch (error) {
    console.error(`Error generating text with ${provider}:`, error);
    throw error;
  }
}
