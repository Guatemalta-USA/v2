import type { Timestamp } from "firebase/firestore";
import type { LocalizedContent, LocalizedString } from "./helper.model";

export class PageContents {
    public pageName: string;
    public lastUpdated: Timestamp;
    public content: LocalizedContent;

    constructor(
        pageName: string,
        lastUpdated: Timestamp,
        content: LocalizedContent
    ) {
        this.pageName = pageName;
        this.lastUpdated = lastUpdated;
        this.content = content;
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
            pageName: this.pageName,
            lastUpdated: this.lastUpdated,
            content: {
                en: this.sanitizeData((this.content as Record<string, any>)?.en ?? ''),
                es: this.sanitizeData((this.content as Record<string, any>)?.es ?? '')
            }
        }
    }

    static fromFirestore(data: Record<string, any>): PageContents {
        let content: LocalizedContent | LocalizedString;
        if (data.content && typeof data.content === 'object' && ('en' in data.content || 'es' in data.content)) {
            content = {
                en: data.content.en ?? '',
                es: data.content.es ?? ''
            }
        } else if (data.content) {
            content = {
                en: data.content,
                es: ''
            }
        } else {
            content = { en: '', es: '' }
        }
        return new PageContents(
            data.pageName,
            data.lastUpdated,
            content
        )
    }
}