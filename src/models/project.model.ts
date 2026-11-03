import { Timestamp, type FirestoreDataConverter } from "firebase/firestore";
import type { LocalizedContent, LocalizedString, SupportedLanguage } from "./helper.model";

export class Project {
    id?: string;
    projectTitle: LocalizedString;
    content: LocalizedString | LocalizedContent;
    isCurrent: boolean;
    published: boolean;
    goalBar: string | null;
    orderIndex: number;
    updatedAt?: Timestamp | Date;

    constructor(
        projectTitle: LocalizedString,
        content: LocalizedString | LocalizedContent,
        isCurrent: boolean = true,
        published: boolean = true,
        goalBar: string | null = null,
        orderIndex: number = 0,
        id?: string,
        updatedAt?: Timestamp | Date
    ) {
        this.id = id;
        this.projectTitle = projectTitle || { en: '', es: '' };
        this.content = content || { en: '', es: '' };
        this.isCurrent = isCurrent;
        this.published = published;
        this.goalBar = goalBar;
        this.updatedAt = updatedAt;
        this.orderIndex = orderIndex;
    }

    getTitle(lang: SupportedLanguage = 'en'): string {
        if (!this.projectTitle) return '';
        return this.projectTitle[lang] || this.projectTitle.en || this.projectTitle.es || '';
    }

    private extractPlainText(contentValue: any): string {
        if (!contentValue) return '';
        let target = contentValue;
        if (typeof target === 'string' && (target.trim().startsWith('{') || target.trim().startsWith('['))) {
            try {
                target = JSON.parse(target);
            } catch {
            }
        }

        if (typeof target === 'string') {
            if (typeof document !== 'undefined') {
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = target;
                return (tempDiv.textContent || tempDiv.innerText || '').trim();
            }
            return target.replace(/<[^>]*>/g, '').trim();
        }

        let ops: any[] | null = null;
        if (Array.isArray(target)) {
            ops = target;
        } else if (typeof target === 'object' && target !== null) {
            ops = target.ops || (typeof target.toJSON === 'function' ? target.toJSON().ops : null);
        }

        if (Array.isArray(ops)) {
            return ops
                .map((op: any) => {
                    if (typeof op.insert === 'string') {
                        return op.insert;
                    }
                    return '';
                })
                .join('')
                .trim();
        }

        return '';
    }

    getFirstParagraph(lang: SupportedLanguage = 'en'): string {
        if (!this.content) return '';

        let rawContent: any = '';
        if (typeof this.content === 'object' && this.content !== null) {
            rawContent = (this.content as Record<string, any>)[lang]
                ?? (this.content as Record<string, any>)['en']
                ?? (this.content as Record<string, any>)['es']
                ?? this.content;
        } else {
            rawContent = this.content;
        }

        const plainText = this.extractPlainText(rawContent);
        if (!plainText) return '';

        const paragraphs = plainText.split(/\r?\n+/).map((p) => p.trim()).filter((p) => p.length > 0);
        return paragraphs.length > 0 ? paragraphs[0] : plainText;
    }

    private sanitizeData(data: any): any {
        if (data === null || data === undefined) {
            return [];
        }

        // 1. If it's already an array, recursively sanitize items
        if (Array.isArray(data)) {
            return data.map((item) => this.sanitizeData(item));
        }

        // 2. If it's a Quill Delta or object containing ops, extract ops array directly
        if (typeof data === 'object' && data !== null) {
            if (Array.isArray(data.ops)) {
                return this.sanitizeData(data.ops);
            }
            if (typeof data.toJSON === 'function') {
                const json = data.toJSON();
                if (json && Array.isArray(json.ops)) {
                    return this.sanitizeData(json.ops);
                }
            }
            // 3. Unwrap accidentally nested 'en' or 'es' keys inside the lang value
            if (Array.isArray(data.en)) {
                return this.sanitizeData(data.en);
            }
            if (Array.isArray(data.es)) {
                return this.sanitizeData(data.es);
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
            projectTitle: {
                en: this.projectTitle?.en || '',
                es: this.projectTitle?.es || ''
            },
            content: {
                en: this.sanitizeData((this.content as Record<string, any>)?.en ?? ''),
                es: this.sanitizeData((this.content as Record<string, any>)?.es ?? '')
            },
            isCurrent: this.isCurrent,
            published: this.published,
            orderIndex: this.orderIndex,
            goalBar: this.goalBar ?? null,
            updatedAt: Timestamp.now()
        };
    }

    static fromFirestore(id: string, data: Record<string, any>): Project {
        const title: LocalizedString = typeof data.projectTitle === 'object' && data.projectTitle !== null
            ? { en: data.projectTitle.en || '', es: data.projectTitle.es || '' }
            : { en: typeof data.projectTitle === 'string' ? data.projectTitle : '', es: '' };

        const rawContentData = data.content ?? data.description ?? data.projectDescription;
        let content: LocalizedContent | LocalizedString;

        if (rawContentData && typeof rawContentData === 'object' && ('en' in rawContentData || 'es' in rawContentData)) {
            content = {
                en: rawContentData.en ?? '',
                es: rawContentData.es ?? ''
            };
        } else if (rawContentData) {
            content = {
                en: rawContentData,
                es: ''
            };
        } else {
            content = { en: '', es: '' };
        }

        return new Project(
            title,
            content,
            data.isCurrent ?? data.currentProject ?? true,
            data.published ?? true,
            data.goalBar ?? null,
            data.orderIndex ?? 0,
            id,
            data.updatedAt
        );
    }
}

// Firestore Converter Definition
export const projectConverter: FirestoreDataConverter<Project> = {
    toFirestore: (project: Project) => project.toFirestore(),
    fromFirestore: (snapshot, options) => {
        const data = snapshot.data(options);
        return Project.fromFirestore(snapshot.id, data);
    }
};

export interface ProjectInfo {
    id?: string;
    projectName: string;
    projectId: string;
    formId: string;
    orderIndex?: number;
}