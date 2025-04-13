export default async function handler(request, response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, OpenAI-Beta");

  if (request.method === "OPTIONS") {
    return response.status(200).end();
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
        "OpenAI-Beta": "assistants=v2"
      }
    });
    const messagesData = await messagesRes.json();
    const assistantMessage = messagesData.data.find(msg => msg.role === "assistant");

    if (!assistantMessage) {
      return response.status(500).json({ error: "Nenhuma resposta do assistente" });
    }

    return response.status(200).json({ message: assistantMessage.content[0].text.value });

  } catch (error) {
    console.error(error);
    return response.status(500).json({ error: "Erro inesperado no servidor" });
  }
}




