import type { Timestamp } from "firebase/firestore";
import type { LocalizedContent, LocalizedString } from "./helper.model";

export class PageContents {
    public pageName: LocalizedString;
    public lastUpdated: Timestamp;
    public content: LocalizedContent;

    constructor(
        pageName: LocalizedString | string,
        lastUpdated: Timestamp,
        content: LocalizedContent
    ) {
        // Normalize pageName to LocalizedString if a plain string was passed
        if (typeof pageName === 'string') {
            this.pageName = { en: pageName, es: '' };
        } else {
            this.pageName = {
                en: pageName?.en || '',
                es: pageName?.es || ''
            };
        }

        this.lastUpdated = lastUpdated;
        this.content = {
            en: content?.en || [],
            es: content?.es || []
        };
    }

    private sanitizeData(data: any): any {
        if (data === null || data === undefined) {
            return data;
        }

        if (Array.isArray(data)) {
            return data.map((item) => this.sanitizeData(item));
        }

        if (typeof data === 'object') {
            if (typeof data.toJSON === 'function') {
                return JSON.parse(JSON.stringify(data.toJSON()));
            }

            const cleanObj: Record<string, any> = {};
            for (const key of Object.keys(data)) {
                cleanObj[key] = this.sanitizeData(data[key]);
            }
            return JSON.parse(JSON.stringify(cleanObj));
        }

        return data;
    }

    toFirestore(): Record<string, any> {
        return {
            pageName: {
                en: this.sanitizeData(this.pageName.en),
                es: this.sanitizeData(this.pageName.es)
            },
            lastUpdated: this.lastUpdated,
            content: {
                en: this.sanitizeData(this.content.en),
                es: this.sanitizeData(this.content.es)
            }
        };
    }

    static fromFirestore(data: Record<string, any>): PageContents {
        let pageName: LocalizedString;
        if (data.pageName && typeof data.pageName === 'object' && ('en' in data.pageName || 'es' in data.pageName)) {
            pageName = {
                en: data.pageName.en || '',
                es: data.pageName.es || ''
            };
        } else if (typeof data.pageName === 'string') {
            pageName = { en: data.pageName, es: '' };
        } else {
            pageName = { en: '', es: '' };
        }

        let content: LocalizedContent;
        if (data.content && typeof data.content === 'object' && ('en' in data.content || 'es' in data.content)) {
            content = {
                en: data.content.en ?? [],
                es: data.content.es ?? []
            };
        } else {
            content = { en: data.content ?? [], es: [] };
        }

        return new PageContents(pageName, data.lastUpdated, content);
    }
}