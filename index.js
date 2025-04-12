export default async function handler(request, response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (request.method === "OPTIONS") {
    return response.status(200).end();
  }

  if (request.method !== "POST") {
    return response.status(405).json({ error: "Método não permitido" });
  }

  const { userInput, assistantId } = request.body;
  const apiKey = process.env.OPENAI_API_KEY;

  try {
    const runRes = await fetch(`https://api.openai.com/v1/assistants/${assistantId}/threads/runs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "OpenAI-Beta": "assistants=v2"
      },
      body: JSON.stringify({
        thread: {
          messages: [{ role: "user", content: userInput }]
        }
      })
    });

    const runData = await runRes.json();

    if (runRes.status !== 200) {
      console.error(runData);
      return response.status(500).json({ error: "Erro ao criar execução" });
    }

    let status = runData.status;
    let runId = runData.id;
    let threadId = runData.thread_id;
    let attempts = 0;

    while (status !== "completed" && attempts < 10) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const checkRes = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs/${runId}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
          "OpenAI-Beta": "assistants=v2"
        }
      });
      const checkData = await checkRes.json();
      status = checkData.status;
      attempts++;
    }

    if (status !== "completed") {
      return response.status(500).json({ error: "Execução não foi concluída" });
    }

    const messagesRes = await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "OpenAI-Beta": "assistants=v2"
      }
    });
    const messagesData = await messagesRes.json();
    const assistantMessage = messagesData.data.find(msg => msg.role === "assistant");

    return response.status(200).json({ message: assistantMessage.content[0].text.value });

  } catch (error) {
    console.error(error);
    return response.status(500).json({ error: "Erro inesperado" });
  }
}

