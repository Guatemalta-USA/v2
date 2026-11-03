export interface LocalizedString {
    en: string;
    es: string;
}

export interface LocalizedContent {
    en: any;
    es: any;
}

export type SupportedLanguage = 'en' | 'es';

export type KeyValue = [string, string];

export type MessageParams = {
    messageBody: string;
    location: "main-message" | "modal-message";
    type: string;
    autoCloseSeconds?: number;
    i18n?: string;
}

export class ImageMetadata {
    public filename: string;
    public altText: string;

    constructor(
        filename: string,
        altText: string
    ) {
        this.filename = filename;
        this.altText = altText;
    }
}