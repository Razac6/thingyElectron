import { GoogleGenerativeAI } from "@google/generative-ai";
import log from 'electron-log';

export async function askGemini(prompt: string, apiKey: string, context: any) {
    if (!apiKey) throw new Error("Missing Gemini API Key");

    // Debugowanie: Sprawdź dostępne modele dla tego klucza API
    try {
        // Używamy globalnego fetch (dostępnego w Node.js 18+)
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        if (response.ok) {
            const data = await response.json();
            const modelNames = (data as any).models?.map((m: any) => m.name) || [];
            log.info("Dostępne modele Gemini (z API):", modelNames);
        } else {
            log.warn("Nie udało się pobrać listy modeli:", response.status, response.statusText);
        }
    } catch (e) {
        log.error("Błąd podczas sprawdzania listy modeli:", e);
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    const tryModel = async (modelName: string) => {
        log.info(`Próba użycia modelu: ${modelName}`);
        const model = genAI.getGenerativeModel({
            model: modelName,
        });

        const chat = model.startChat({
            history: [],
            generationConfig: {
                maxOutputTokens: 500,
            },
        });

        const systemContext = `Jesteś Thingy, asystentem produktywności Marcina. Odpowiadaj krótko i po polsku.
        Kontekst użytkownika: ${JSON.stringify(context)}.`;

        const result = await chat.sendMessage(`${systemContext}\n\nUżytkownik pyta: ${prompt}`);
        const response = await result.response;
        return response.text();
    };

    try {
        // Na podstawie logów użytkownika, dostępne są nowsze modele 2.0 i 2.5
        // Próbujemy gemini-2.0-flash jako domyślny
        return await tryModel("gemini-2.0-flash");
    } catch (error: any) {
        log.warn(`Błąd z gemini-2.0-flash: ${error.message}. Próba alternatywna...`);

        try {
            // Próba z aliasem latest, który jest na liście
            return await tryModel("gemini-flash-latest");
        } catch (error2: any) {
             log.warn(`Błąd z gemini-flash-latest: ${error2.message}. Próba fallbacku do gemini-2.5-flash...`);
             try {
                // Ostateczny fallback do wersji 2.5
                return await tryModel("gemini-2.5-flash");
             } catch (fallbackError: any) {
                log.error('Wszystkie próby modeli zawiodły.', fallbackError);
                throw error; // Rzucamy pierwszy błąd
             }
        }
    }
}
