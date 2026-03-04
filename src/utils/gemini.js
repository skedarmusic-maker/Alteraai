import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI("AIzaSyBOujw4WaB4dFTGiI2icjMg5pEfVlY7nPQ");
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

export const generateSummary = async (prompt) => {
    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error("Erro na IA:", error);
        // Expor a mensagem real do erro (ex: 429 Too Many Requests)
        return `⚠️ Falha ao gerar resumo: ${error.message}`;
    }
};
