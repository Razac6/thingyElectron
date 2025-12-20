const { parentPort } = require('worker_threads');
const { pipeline, env, TextStreamer } = require('@huggingface/transformers');

// Konfiguracja
env.allowLocalModels = false;

let generator = null;
let tokenizer = null;

async function init(device) {
    try {
        // Zmieniamy na Qwen 2.5 1.5B - jest znacznie stabilniejszy od Llamy 1B
        generator = await pipeline('text-generation', 'onnx-community/Qwen2.5-1.5B-Instruct', {
            progress_callback: (info) => {
                parentPort.postMessage({ type: 'progress', data: info });
            },
            device: device || 'cpu',
            dtype: 'q4', 
        });
        tokenizer = generator.tokenizer;
        parentPort.postMessage({ type: 'ready' });
    } catch (e) {
        parentPort.postMessage({ type: 'error', error: e.message });
    }
}

async function generate(prompt, context) {
    if (!generator) {
        parentPort.postMessage({ type: 'error', error: 'Model not initialized' });
        return;
    }

    const messages = [
        { 
            role: "system", 
            content: "Jesteś Thingy, inteligentnym asystentem produktywności. Mówisz po polsku. Odpowiadasz krótko i konkretnie." 
        },
        { role: "user", content: prompt }
    ];

    try {
        const streamer = new TextStreamer(tokenizer, {
            skip_prompt: true,
            callback_function: (text) => {
                // Czyścimy tekst z ewentualnych znaczników specjalnych modelu
                const cleanText = text.replace(/<|im_end|>/g, '');
                parentPort.postMessage({ type: 'delta', data: cleanText });
            },
        });

        await generator(messages, {
            max_new_tokens: 150,
            temperature: 0.3,
            top_k: 20,
            do_sample: true,
            streamer,
        });
        
        parentPort.postMessage({ type: 'response_end' });
    } catch (e) {
        parentPort.postMessage({ type: 'error', error: e.message });
    }
}

parentPort.on('message', async (msg) => {
    if (msg.type === 'init') {
        await init(msg.device);
    } else if (msg.type === 'generate') {
        await generate(msg.prompt, msg.context);
    }
});
