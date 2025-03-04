import * as dotenv from "dotenv";
import { resolve } from "path";
import {
  genericGenerateText,
  genericGenerateImage,
} from "../../lib/vercel-sdk";

// Load env before all tests
beforeAll(() => {
  dotenv.config({ path: resolve(process.cwd(), ".env.local") });
});

describe("Text Generation", () => {
  test("generates text with default OpenAI model", async () => {
    const result = await genericGenerateText({
      provider: "openai",
      model: "gpt-4",
      prompt: "Say hello",
    });
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  test("generates text with Claude model", async () => {
    const result = await genericGenerateText({
      provider: "anthropic",
      model: "claude-3-5-sonnet-20241022",
      prompt: "Say hello",
    });
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  test("throws error for invalid model", async () => {
    await expect(
      genericGenerateText({
        provider: "openai",
        model: "invalid-model" as any,
        prompt: "test",
      })
    ).rejects.toThrow(/Unsupported model/);
  });
});

describe("Image Generation", () => {
  test("generates image with DALL-E 3", async () => {
    const result = await genericGenerateImage({
      provider: "openai",
      model: "dall-e-3",
      prompt: "A sunset",
      size: "1024x1024",
    });
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  test("generates multiple images with size and seed", async () => {
    const result = await genericGenerateImage({
      provider: "openai",
      model: "dall-e-3",
      prompt: "A sunset",
      size: "1024x1024",
      n: 2,
      seed: 123,
    });
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(2);
  });

  test("throws error for invalid size", async () => {
    await expect(
      genericGenerateImage({
        provider: "openai",
        model: "dall-e-3",
        prompt: "test",
        size: "invalid-size" as any,
      })
    ).rejects.toThrow(/Unsupported size/);
  });
});
