
export async function testGeminiConnection(): Promise<string> {
  try {
    const response = await fetch('/api/ai/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Server Fehler: ${response.status}`);
    }
    
    const data = await response.json();
    return data.text || "Keine Antwort";
  } catch (error: any) {
    console.error("Gemini Test Error:", error);
    if (error.message?.includes("403") || error.message?.includes("PERMISSION_DENIED") || error.message?.includes("not set")) {
      throw new Error("Gemini Zugriff verweigert oder API-Key fehlt. Bitte prüfe die Secrets in AI Studio und stelle sicher, dass die Gemini API aktiviert ist.");
    }
    throw new Error(`Gemini Verbindungsfehler: ${error.message}`);
  }
}

export async function translateContent(text: string, targetLangs: string[]): Promise<Record<string, string>> {
  if (targetLangs.length === 0) return {};
  try {
    const response = await fetch('/api/ai/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, targetLangs })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Server Fehler: ${response.status}`);
    }

    return await response.json();
  } catch (error: any) {
    console.error("Gemini Translation Error:", error);
    throw new Error(`Übersetzungsfehler: ${error.message}`);
  }
}
