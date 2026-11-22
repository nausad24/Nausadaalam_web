// Vercel Serverless Function: Connects Robert AI to Google Gemini with Fast Flash-Lite models
module.exports = async function handler(req, res) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      configured: false,
      error: 'GEMINI_API_KEY environment variable not configured on Vercel'
    });
  }

  try {
    const { message, currentDate } = req.body || {};
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Valid message string is required' });
    }

    const todayStr = currentDate || new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const systemPrompt = `You are Robert, the official AI companion on Nausad Aalam's personal website (https://nausadaalam.com.np).
Today's Date: ${todayStr}.

CRITICAL RULES:
1. Provide a direct, summarized answer in EXACTLY ONE SENTENCE (or maximum 2 short sentences). Never write long paragraphs or essays.
2. For Nausad Aalam's details, use these exact concise wordings:
   - About Nausad: "Nausad Aalam is a high-achieving Chartered Accountancy (CA Intermediate) aspirant registered under ICAI and 1st Prize Winner at the national KIST Inter-College IT Competition from Siraha, Nepal."
   - CA Details: "Nausad cleared CA Foundation in January 2025 on his first attempt and is actively preparing for CA Intermediate Group 1 & 2 under ICAI (Student Reg: FRO0592267)."
   - Academics: "Nausad graduated +2 Management from Trinity International College with an outstanding 3.72 GPA (3.67 in Grade 11) and scored 3.50 GPA (Grade A) in SEE from Adarsha Secondary School."
   - KIST Award: "Nausad led his team to 1st Position (Championship Trophy & Gold Medals) at the national KIST Inter-College IT Competition 2024."
   - Skills: "Nausad specializes in ICAI Standards, Corporate Law, Direct Taxation & GST, and Advanced Financial Modeling in Microsoft Excel."
   - Contact: "You can reach Nausad directly on WhatsApp at +977 9816732482 or email nausadalam9714@gmail.com."
3. For general questions (date, weather, definitions, facts): respond directly and concisely in exactly ONE sentence.`;

    // Fast flash-lite models for sub-second responses
    const candidateModels = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.8-flash'];
    let lastError = null;

    for (const model of candidateModels) {
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const geminiRes = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `${systemPrompt}\n\nVisitor: ${message}\nRobert (1 sentence):`
                  }
                ]
              }
            ],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 100
            }
          })
        });

        if (geminiRes.ok) {
          const data = await geminiRes.json();
          const replyText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (replyText) {
            return res.status(200).json({ reply: replyText.trim(), source: model });
          }
        } else {
          lastError = await geminiRes.text();
        }
      } catch (err) {
        lastError = err.message;
      }
    }

    return res.status(500).json({ error: 'All Gemini models failed', details: lastError });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
