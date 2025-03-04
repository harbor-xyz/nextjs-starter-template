const dotenv = require("dotenv");
const path = require("path");
const vercelSdk = require("../lib/vercel-sdk");

dotenv.config({ path: path.resolve(__dirname, "..", ".env.local") });

// this is an internal testing file to see if the vercel-sdk integration is working

async function main() {
  console.log("OPEN AI API KEY");
  console.log(process.env.OPENAI_API_KEY);
  const {
    values: { type, provider, model, prompt, size, n, seed },
  } = require("node:util").parseArgs({
    options: {
      type: { type: "string", short: "t", default: "text" },
      provider: { type: "string", short: "p", default: "openai" },
      model: { type: "string", short: "m", default: "gpt-4" },
      prompt: { type: "string", default: "Hello, how are you?" },
      size: { type: "string", default: "1024x1024" },
      n: { type: "string", default: "1" },
      seed: { type: "string", default: "1234" },
    },
  });

  try {
    if (type === "image") {
      const images = await vercelSdk.genericGenerateImage({
        provider: provider as "openai",
        model: model as typeof vercelSdk.ModelName,
        prompt: prompt as string,
        size: size as "1024x1024" | "1792x1024" | "1024x1792",
        n: n ? (parseInt(n) as 1 | 2 | 3 | 4) : undefined,
        seed: seed ? parseInt(seed) : undefined,
      });
      console.log("Generated images:", images);
    } else {
      const text = await vercelSdk.genericGenerateText({
        provider: provider as "openai" | "anthropic",
        model: model as typeof vercelSdk.ModelName,
        prompt: prompt as string,
      });
      console.log("Generated text:", text);
    }
  } catch (error) {
    console.error("Error:", (error as Error).message);
    process.exit(1);
  }
}

main();
