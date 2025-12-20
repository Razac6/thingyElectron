import { Worker } from 'worker_threads';
import path from 'path';
import { logSystemEvent } from './db';

export class LlamaEngine {
    private worker: Worker | null = null;
    private isInitializing: boolean = false;
    private isReady: boolean = false;
    private progress: number = 0;
    private resolveGenerate: ((v: string) => void) | null = null;
    private onStream: ((chunk: string) => void) | null = null;
    private currentResponse: string = "";
    private isBusy: boolean = false;

    async initialize(onProgress?: (data: { progress: number, status: string }) => void) {
        if (this.isReady || this.isInitializing) return;
        
        this.isInitializing = true;
        logSystemEvent('Inicjalizacja Qwen 2.5 1.5B (AI)...', 'AI');

        // Note: In development __dirname might be different depending on how it's run
        // For ERB, main files are usually compiled to a dist folder or run via ts-node
        const workerPath = path.join(__dirname, 'LlamaWorker.js');
        this.worker = new Worker(workerPath);

        this.worker.on('message', (msg) => {
            if (!msg) return;

            if (msg.type === 'progress' && msg.data) {
                const info = msg.data;
                let statusText = 'Pobieranie...';
                if (info.status === 'initiate') statusText = 'Inicjalizacja...';
                if (info.status === 'progress') {
                    this.progress = info.progress || 0;
                    statusText = `Pobieranie: ${Math.round(this.progress)}%`;
                }
                if (info.status === 'done') statusText = 'Montowanie...';
                if (onProgress) onProgress({ progress: this.progress, status: statusText });
            }

            if (msg.type === 'ready') {
                this.isReady = true;
                this.isInitializing = false;
                logSystemEvent('Qwen 2.5 gotowa w osobnym wątku.', 'AI');
                if (onProgress) onProgress({ progress: 100, status: 'Model gotowy!' });
            }

            if (msg.type === 'delta' && msg.data) {
                this.currentResponse += msg.data;
                if (this.onStream) this.onStream(msg.data);
            }

            if (msg.type === 'response_end') {
                if (this.resolveGenerate) {
                    this.resolveGenerate(this.currentResponse || "");
                    this.resolveGenerate = null;
                    this.onStream = null;
                }
                this.isBusy = false;
            }

            if (msg.type === 'error') {
                console.error('Llama Worker Error:', msg.error || 'Unknown error');
                logSystemEvent(`Błąd AI: ${msg.error || 'Unknown error'}`, 'ERROR');
                this.isInitializing = false;
                this.isBusy = false;
                if (this.resolveGenerate) {
                    this.resolveGenerate(`Error: ${msg.error || 'Unknown error'}`);
                    this.resolveGenerate = null;
                }
            }
        });

        this.worker.postMessage({ type: 'init', device: 'dml' }); // DirectML for Windows
    }

    async generateMessage(prompt: string, context: any, onStream?: (chunk: string) => void): Promise<string> {
        if (!this.isReady) return "AI się jeszcze budzi...";
        if (this.isBusy) return "AI jest zajęte...";

        this.isBusy = true;
        return new Promise((resolve) => {
            this.currentResponse = "";
            this.onStream = onStream || null;
            this.resolveGenerate = resolve;
            this.worker?.postMessage({ type: 'generate', prompt, context });
        });
    }

    getStatus() {
        return {
            ready: this.isReady,
            progress: this.progress,
            isInitializing: this.isInitializing
        };
    }
}

export const llamaEngine = new LlamaEngine();