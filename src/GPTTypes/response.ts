/**
 * Request
 */
export interface response {
    choices: Choice[];
    created: number;
    id: string;
    object: string;
    usage: Usage;
    [property: string]: any;
}

export interface Choice {
    finish_reason?: string;
    index?: number;
    message?: Message;
    [property: string]: any;
}

export interface Message {
    content: string;
    role: string;
    [property: string]: any;
}

export interface Usage {
    completion_tokens: number;
    prompt_tokens: number;
    total_tokens: number;
    [property: string]: any;
}