export {};

declare global {
  interface Window {
    vibeLiveOpenAI?: {
      chatCompletionsCreate(payload: {
        apiKey: string;
        baseURL?: string;
        body: unknown;
      }): Promise<{
        choices?: Array<{
          message?: {
            content?: string | null;
          };
        }>;
      }>;
      imagesGenerate(payload: {
        apiKey: string;
        baseURL?: string;
        body: unknown;
      }): Promise<{
        data?: Array<{
          url?: string;
          b64_json?: string;
          revised_prompt?: string;
        }>;
        error?: {
          message?: string;
          code?: string;
        };
      }>;
    };
  }
}
