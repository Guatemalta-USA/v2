import { serverTimestamp, Timestamp, type FirestoreDataConverter } from "firebase/firestore";
import type { LocalizedContent, LocalizedString, SupportedLanguage } from "./helper.model";

export class Post {
    public id?: string;
    public postTitle: LocalizedString;
    public author: string;
    public publishDate: Timestamp | Date;
    public lastUpdated: Timestamp | Date;
    public content: LocalizedString | LocalizedContent;
    public linkedProjectId: string;

    constructor(
        postTitle: LocalizedString,
        author: string,
        publishDate: Timestamp | Date,
        lastUpdated: Timestamp | Date,
        content: LocalizedString | LocalizedContent,
        linkedProjectId: string
    ) {
        this.postTitle = postTitle;
        this.author = author;
        this.publishDate = publishDate;
        this.lastUpdated = lastUpdated;
        this.content = content;
        this.linkedProjectId = linkedProjectId;
    }

    getTitle(lang: SupportedLanguage = 'en'): string {
        if (!this.postTitle) return '';
        return this.postTitle[lang] || this.postTitle.en || this.postTitle.es || '';
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

    toFirestore() {
        // Force content.en and content.es to be unwrapped clean arrays
        const rawEn = (this.content as Record<string, any>)?.en ?? '';
        const rawEs = (this.content as Record<string, any>)?.es ?? '';

        return {
            postTitle: {
                en: this.postTitle?.en || '',
                es: this.postTitle?.es || '',
            },
            author: this.author,
            publishDate: this.publishDate,
            lastUpdated: serverTimestamp(),
            content: {
                en: this.sanitizeData(rawEn),
                es: this.sanitizeData(rawEs)
            },
            linkedProjectId: this.linkedProjectId
        };
    }

    static fromFirestore(id: string, data: any): Post {
        const title: LocalizedString = typeof data.postTitle === 'object' && data.postTitle !== null
            ? { en: data.postTitle.en || '', es: data.postTitle.es || '' }
            : { en: typeof data.postTitle === "string" ? data.postTitle : '', es: '' };

        const rawContentData = data.content ?? data.description ?? data.postDescription;
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

        const post = new Post(
            title,
            data.author,
            data.publishDate,
            data.lastUpdated,
            content,
            data.linkedProjectId
        );
        post.id = id;
        return post;
    }
}

export const postConverter: FirestoreDataConverter<Post> = {
    toFirestore: (post: Post) => post.toFirestore(),
    fromFirestore: (snapshot, options) => {
        const data = snapshot.data(options);
        return Post.fromFirestore(snapshot.id, data);
    }
}