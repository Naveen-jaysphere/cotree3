import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Google Gemini API securely on the server side
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// Endpoint 1: Virtual Arborist / Tree Advisor Consultation
app.post("/api/tree-advisor", async (req, res) => {
  const { question, species, sympton, userLocation } = req.body;

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ 
      error: "Gemini API key is not configured. Please add it to Settings -> Secrets." 
    });
  }

  try {
    const prompt = `
      You are Ingrid, a highly knowledgeable, professional, and straightforward tree care expert who owns C&O Tree Service in Middle Tennessee (established in 2019, serving Nashville and the surrounding areas) for many years. 
      You are deeply committed to:
      1. Premium, reliable professionalism (safety-first, clean sites, fully insured, highly skilled tree trimming, safe tree removal, and stump grinding).
      2. Honest and straightforward communication (clear upfront pricing, zero hassle, doing the job right the first time).
      3. Native Tennessee species knowledge (Loblolly Pine, White Oak, Sugar Maple, Tulip Poplar, Eastern Redcedar, Hickories) and local issues (Eastern Tent Caterpillar, Emerald Ash Borer, Middle TN clay soil, storms/humid weather).

      A homeowner in Nashville or surrounding area is asking you:
      - Tree Species: ${species || "Not specified / Unknown"}
      - Symptoms/Observed Issue: ${sympton || "Not specified"}
      - Detail/Question: "${question || "Just seeking tree advice."}"
      - Locality: ${userLocation || "Nashville and surrounding areas"}

      Answer their question as Ingrid from C&O Tree Service. Be direct, professional, and straightforward. 
      Keep the response structured and scannable. Include:
      1. What you suspect is happening based on Middle Tennessee climates and pests.
      2. C&O Tree Service's Action Plan (recommending straightforward tree trimming, removal, or care depending on what is safest and most effective).
      3. A direct, professional invite to call us at (214) 927-1976 for a free upfront on-site estimate.
      Keep it around 150-250 words. Do not sound preachy; sound like a reliable, straightforward local tree service professional.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
    });

    res.json({ answer: response.text });
  } catch (error: any) {
    console.error("Gemini API error:", error);
    res.status(500).json({ error: error.message || "An error occurred with Ingrid's virtual advice system." });
  }
});

// Endpoint 2: Instant Estimate Generator & Recommendation
app.post("/api/tree-estimator", async (req, res) => {
  const { serviceType, treeCount, treeHeight, accessibility, userDetails } = req.body;

  if (!serviceType || !treeCount || !treeHeight) {
    return res.status(400).json({ error: "Missing required details for a ballpark estimate." });
  }

  // Pure logic calculation to get a base ballpark price
  let basePrice = 0;
  if (serviceType === "pruning") {
    basePrice = 250;
  } else if (serviceType === "removal") {
    basePrice = 650;
  } else if (serviceType === "health_treatment") {
    basePrice = 150;
  } else if (serviceType === "stump_grinding") {
    basePrice = 180;
  } else {
    basePrice = 200;
  }

  // Height multiplier
  let heightMultiplier = 1;
  if (treeHeight === "medium") heightMultiplier = 1.6;
  if (treeHeight === "large") heightMultiplier = 2.8;

  // Accessibility multiplier
  let accessMultiplier = 1;
  if (accessibility === "limited") accessMultiplier = 1.35;
  if (accessibility === "hard") accessMultiplier = 1.7;

  // Total calculated ballpark
  const calculatedBallparkMin = Math.round(basePrice * heightMultiplier * accessMultiplier * treeCount * 0.9);
  const calculatedBallparkMax = Math.round(basePrice * heightMultiplier * accessMultiplier * treeCount * 1.15);

  try {
    // Generate private arborist recommendations from Ingrid relative to this task
    let prompt = `
      You are Ingrid, owner of C&O Tree Service in Middle TN. Give a quick, straightforward 2-3 sentence recommendation for this requested job:
      - Service: ${serviceType === "pruning" ? "Tree Trimming" : serviceType === "removal" ? "Tree Removal" : serviceType === "health_treatment" ? "Soil/Disease Care" : "Stump Grinding"}
      - Height class: ${treeHeight}
      - Tree count: ${treeCount}
      - Site accessibility: ${accessibility === "open" ? "Easy/Open Access" : "Tight Yard/Near structures"}

      Write in first person ("I am Ingrid...", "Our team at C&O Tree Service..."). Keep it straightforward, professional, and clear. Explain how we approach this safely and efficiently under 85 words.
    `;

    let recommendation = "";
    if (process.env.GEMINI_API_KEY) {
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
      });
      recommendation = response.text || "";
    } else {
      recommendation = "We will evaluate your tree structure, focus on a safe and efficient strategy, and ensure your yard is left entirely clean and tidy.";
    }

    res.json({
      priceRange: `$${calculatedBallparkMin} - $${calculatedBallparkMax}`,
      recommendation: recommendation.trim(),
    });
  } catch (error) {
    console.error("Estimator description error:", error);
    res.json({
      priceRange: `$${calculatedBallparkMin} - $${calculatedBallparkMax}`,
      recommendation: "Our high-climbing crews focus on safe rigging practices and complete lawn and property protection.",
    });
  }
});

// Handle Vite middleware & asset serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
