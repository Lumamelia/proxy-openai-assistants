export default async function handler(request, response) {
  // LIBERA CORS APENAS PARA SEU DOMÍNIO
  response.setHeader("Access-Control-Allow-Origin", "https://metajuri.site");
  response.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, OpenAI-Beta");

  if (request.method === "OPTIONS") {
    response.status(200).end();
    return;
  }

  if (request.method !== "POST") {
    return response.status(405).json({ error: "Método não permitido" });
  }

  const { userInput, assistantId } = request.body;
  const apiKey = process.env.OPENAI_API_KEY;

  if (!userInput || !assistantId) {
    return response.status(400).json({ error: "Parâmetros inválidos" });
  }

  try {
    const threadRes = await fetch("https://api.openai.com/v1/threads", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "OpenAI-Beta": "assistants=v2"
      }
    });
    const threadData = await threadRes.json();
    const threadId = threadData.id;

    await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "OpenAI-Beta": "assistants=v2"
      },
      body: JSON.stringify({
        role: "user",
        content: userInput
      })
    });

    const runRes = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "OpenAI-Beta": "assistants=v2"
      },
      body: JSON.stringify({
        assistant_id: assistantId
      })
    });
    const runData = await runRes.json();
    const runId = runData.id;

    let status = "queued";
    let attempts = 0;
    while (status !== "completed" && attempts < 10) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const statusCheck = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs/${runId}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "OpenAI-Beta": "assistants=v2"
        }
      });
      const statusData = await statusCheck.json();
      status = statusData.status;
      attempts++;
    }

    if (status !== "completed") {
      return response.status(500).json({ error: "Execução não foi concluída" });
    }

    const messagesRes = await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "OpenAI-B






