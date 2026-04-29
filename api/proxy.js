export const config = {
  api: {
    bodyParser: true,
  },
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch {}
  }

  const { type, fileKey, nodeId, url } = body || req.query || {};

  try {
    // --- Figma fetch ---
    if (type === "figma") {
      if (!fileKey) return res.status(400).json({ error: "Missing fileKey" });

      const figmaUrl = nodeId
        ? `https://api.figma.com/v1/files/${fileKey}/nodes?ids=${encodeURIComponent(nodeId)}`
        : `https://api.figma.com/v1/files/${fileKey}`;

      const figmaRes = await fetch(figmaUrl, {
        headers: { "X-Figma-Token": process.env.FIGMA_PAT },
      });

      if (!figmaRes.ok) {
        return res.status(figmaRes.status).json({ error: `Figma API error: ${figmaRes.statusText}` });
      }

      const data = await figmaRes.json();
      return res.status(200).json(data);
    }

    // --- URL inspection ---
    if (type === "inspect") {
      if (!url) return res.status(400).json({ error: "Missing url" });

      const pageRes = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; QABot/1.0)" },
      });

      if (!pageRes.ok) {
        return res.status(pageRes.status).json({ error: `Could not fetch page: ${pageRes.statusText}` });
      }

      const html = await pageRes.text();

      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const metaDesc = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
      const bodyText = html
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 3000);

      return res.status(200).json({
        page_title: titleMatch?.[1] || "",
        meta_description: metaDesc?.[1] || "",
        visible_text: bodyText,
        console_errors: [],
        layout_description: `Fetched from ${url}`,
      });
    }

    return res.status(400).json({ error: "Invalid type. Use 'figma' or 'inspect'." });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
