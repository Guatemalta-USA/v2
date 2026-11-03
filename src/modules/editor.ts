import Quill from 'quill';
import 'quill/dist/quill.snow.css';
import { ALL_APP_PATHS } from './navigate';
import imageCompression from 'browser-image-compression';
import { ImageResize } from 'quill-image-resize-module-ts';
import { createMessage, formatDate, makeElement, promptModal } from './utils';
import i18n, { updateContent, getResolvedLanguage } from './i18n';
import { registerCustomQuillBlots } from './quillBlots';
import { getPageContents, updatePageContents } from '../services/firebaseService';

function extractOps(langData: any): any[] {
    if (!langData) return [];
    if (Array.isArray(langData)) return langData;
    if (Array.isArray(langData.ops)) return langData.ops;
    if (Array.isArray(langData.en)) return langData.en;
    return [];
}

// Initialize and register custom Quill formats
registerCustomQuillBlots();

if (!Quill.imports['modules/imageResize']) {
    Quill.register('modules/imageResize', ImageResize);
}

export function isEmptyDelta(deltaObj: any): boolean {
    if (!deltaObj) return true;
    const ops = Array.isArray(deltaObj) ? deltaObj : deltaObj.ops;
    if (!Array.isArray(ops) || ops.length === 0) {
        return true;
    }
    if (ops.length === 1) {
        const op = ops[0];
        if (typeof op.insert === 'string' && (op.insert === '\n' || op.insert.trim() === '')) {
            return true;
        }
    }
    return ops.every((op: any) => typeof op.insert === 'string' && op.insert.replace(/\n/g, '').trim() === '');
}

function getInitialLanguage(): 'en' | 'es' {
    const lang = (getResolvedLanguage() || 'en').slice(0, 2).toLowerCase();
    return lang === 'es' ? 'es' : 'en';
}

export class TheEditor {
    public quill!: Quill;
    public currentPage: string | null = null;
    private deletedImageURLs: string[] = [];
    private deleteObserver: MutationObserver | null = null;
    private activeImageElement: HTMLImageElement | null = null;
    private trackedImages: Set<string> = new Set();

    // Tab state management (single source of truth)
    private currentTab: 'en' | 'es' = getInitialLanguage();
    private contentState: { en: any[]; es: any[] } = {
        en: [],
        es: []
    };

    constructor() {
        const container = document.getElementById('editor-container');
        if (!container) {
            throw new Error(`Editor container with ID "#editor-container" was not found in the DOM.`);
        }

        this.quill = new Quill(container, {
            theme: 'snow',
            placeholder: 'Start writing your content...',
            modules: {
                table: true,
                toolbar: {
                    container: [
                        [{ header: [1, 2, 3, false] }],
                        ['bold', 'italic', 'underline'],
                        [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                        ['givebutter', 'action-link', 'link', { 'nav-link': ALL_APP_PATHS }, 'mailto'],
                        ['table', 'image', 'video'],
                        ['clean']
                    ],
                    handlers: {
                        'link': async () => {
                            const linkResponse = await promptModal("Enter URL", ["url..."], "Insert url", false);
                            if (linkResponse) {
                                const url = linkResponse[0];
                                if (url) this.quill.format('link', url);
                            }
                        },
                        'givebutter': async () => {
                            const range = this.quill.getSelection();
                            const gbResponse = await promptModal(
                                "Enter Givebutter Widget ID\n(Found in the embed code of the form widget)",
                                ["e.g., gRGya8"],
                                "Insert Widget",
                                false
                            );
                            if (gbResponse) {
                                const widgetId = gbResponse[0];
                                if (widgetId !== null) {
                                    if (range) {
                                        this.quill.insertEmbed(range.index, 'givebutter', widgetId, Quill.sources.USER);
                                        this.quill.setSelection(range.index + 1);
                                    } else {
                                        const length = this.quill.getLength();
                                        this.quill.insertEmbed(length, 'givebutter', widgetId, Quill.sources.USER);
                                    }
                                }
                            }
                        },
                        'action-link': async () => {
                            const actionLinkResponse = await promptModal("Enter Action URL", ["url..."], "Add Action Button", false);
                            if (actionLinkResponse) {
                                const url = actionLinkResponse[0];
                                if (url) this.quill.format('actionLink', url);
                            }
                        },
                        'nav-link': (value: string) => {
                            if (value) {
                                const range = this.quill.getSelection();
                                if (range && range.length > 0) {
                                    this.quill.format('link', value);
                                } else {
                                    const index = range ? range.index : 0;
                                    this.quill.insertText(index, value, 'link', value);
                                    this.quill.setSelection(index + value.length);
                                }
                            }
                        },
                        'image': () => {
                            this.selectLocalImage();
                        },
                        'video': async () => {
                            const range = this.quill.getSelection();
                            const videoResponse = await promptModal(
                                "Enter the URL of the video",
                                ["video url"],
                                "Insert Video",
                                false
                            );
                            if (videoResponse) {
                                const url = videoResponse[0];
                                if (url && url !== "") {
                                    if (range) {
                                        this.quill.insertEmbed(range.index, 'video', url, Quill.sources.USER);
                                        this.quill.setSelection(range.index + 1);
                                    } else {
                                        const length = this.quill.getLength();
                                        this.quill.insertEmbed(length, 'video', url, Quill.sources.USER);
                                    }
                                }
                            }
                        },
                        'mailto': async () => {
                            const savedRange = this.quill.getSelection();
                            const savedIndex = savedRange ? savedRange.index : this.quill.getLength() - 1;
                            const savedLength = savedRange ? savedRange.length : 0;

                            const emailResponse = await promptModal(
                                "Enter Email Address",
                                ["example@domain.com"],
                                "Insert Email Link",
                                false
                            );
                            if (emailResponse) {
                                const email = emailResponse[0];
                                if (email && email.trim() !== "") {
                                    const mailtoUrl = email.startsWith('mailto:') ? email.trim() : `mailto:${email.trim()}`;
                                    this.quill.focus();

                                    if (savedLength > 0) {
                                        this.quill.formatText(savedIndex, savedLength, 'link', mailtoUrl);
                                    } else {
                                        this.quill.insertText(savedIndex, email, 'link', mailtoUrl);
                                        this.quill.setSelection(savedIndex + email.length);
                                    }
                                }
                            }
                        },
                        'table': () => {
                            const tableModule = this.quill.getModule('table') as any;
                            if (tableModule) {
                                tableModule.insertTable(1, 2);
                            }
                        }
                    }
                }
            }
        });

        // Initialize Image Resize Module manually
        const ImageResizeModule = Quill.import('modules/imageResize') as any;
        (this.quill as any).theme.modules.imageResize = new ImageResizeModule(this.quill, {
            displaySize: true,
            modules: ['Resize', 'DisplaySize'],
            handleStyles: {
                backgroundColor: '#a855f7',
                border: 'none',
                color: 'white'
            }
        });

        this.quill.on('selection-change', (range) => {
            if (!range) return;
            setTimeout(() => {
                const overlay = document.querySelector('div[style*="border: 1px dashed"]');
                if (overlay && !document.getElementById('custom-image-toolbar')) {
                    this.injectCustomToolbar(overlay as HTMLElement);
                }
            }, 50);
        });

        this.setupToolbarUI();
        this.setupDeleteObserver();
        this.setupImageClickTracking();
    }

    public setContentState(content: { en?: any[]; es?: any[] } | null | undefined): void {
        const sanitizeOps = (data: any): any[] => {
            if (!data) return [];
            if (Array.isArray(data)) return data;
            if (Array.isArray(data.ops)) return data.ops;
            if (Array.isArray(data.en)) return data.en;
            return [];
        };

        this.contentState = {
            en: sanitizeOps(content?.en),
            es: sanitizeOps(content?.es)
        };

        // Load initial tab content cleanly
        let initialOps = this.contentState[this.currentTab];
        if (this.currentTab === 'es' && isEmptyDelta(initialOps)) {
            initialOps = this.contentState.en;
        }

        if (this.deleteObserver) this.deleteObserver.disconnect();
        this.quill.setContents((initialOps || []) as any);
        this.trackedImages = new Set(this.getImagesFromEditor());

        if (this.deleteObserver) {
            this.deleteObserver.observe(this.quill.root, { childList: true, subtree: true });
        }
    }

    public getCurrentLanguage(): 'en' | 'es' {
        return this.currentTab;
    }

    public switchLanguageTab(lang: 'en' | 'es') {
        if (this.currentTab === lang) return;

        // Save current tab editor content into memory
        this.contentState[this.currentTab] = this.quill.getContents().ops;

        // Switch active target
        this.currentTab = lang;

        // Temporarily pause image delete tracking when swapping document contents
        if (this.deleteObserver) this.deleteObserver.disconnect();

        // Determine target content with fallback to English if Spanish is empty
        let nextContent = this.contentState[lang];
        if (lang === 'es' && isEmptyDelta(nextContent)) {
            nextContent = this.contentState.en;
        }

        this.quill.setContents((nextContent || []) as any);

        // Resync tracked images and reconnect observer
        this.trackedImages = new Set(this.getImagesFromEditor());
        if (this.deleteObserver) {
            this.deleteObserver.observe(this.quill.root, { childList: true, subtree: true });
        }
    }

    public setLanguage(lang: 'en' | 'es') {
        if (this.currentTab !== lang) {
            this.switchLanguageTab(lang);
        }
    }

    private setupImageClickTracking() {
        this.quill.root.addEventListener('mousedown', (e) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'IMG') {
                this.activeImageElement = target as HTMLImageElement;
                target.classList.add('ql-active');
            } else {
                this.activeImageElement = null;
                document.querySelectorAll('.ql-editor img').forEach(img => img.classList.remove('ql-active'));
            }
        });
    }

    private injectCustomToolbar(parent: HTMLElement) {
        const toolbar = document.createElement('div');
        toolbar.id = 'custom-image-toolbar';
        toolbar.style.cssText = `
            position: absolute;
            top: -40px;
            left: 50%;
            transform: translateX(-50%);
            display: flex;
            background: #1a1a1a;
            padding: 4px;
            border-radius: 4px;
            border: 1px solid #a855f7;
            z-index: 10002;
        `;

        const alignments = [
            { label: 'Left', style: 'float: left; margin: 0 1em 1em 0;', icon: 'M21 6H3M15 12H3M17 18H3' },
            { label: 'Center', style: 'display: block; margin: auto;', icon: 'M18 6H6M21 12H3M18 18H6' },
            { label: 'Right', style: 'float: right; margin: 0 0 1em 1em;', icon: 'M21 6H3M21 12H9M21 18H7' }
        ];

        alignments.forEach(align => {
            const btn = document.createElement('button');
            btn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#a855f7" stroke-width="2"><path d="${align.icon}"/></svg>`;
            btn.style.cssText = "background: none; border: none; cursor: pointer; padding: 4px; display: flex;";

            btn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();

                let img = document.querySelector('img.ql-active') as HTMLImageElement || this.activeImageElement;
                if (!img) {
                    const images = Array.from(document.querySelectorAll('.ql-editor img'));
                    img = images.find(i => i.classList.contains('ql-active')) as HTMLImageElement;
                }

                if (img) {
                    const blot = Quill.find(img) as any;
                    if (blot) {
                        blot.format('style', align.style);
                    }
                }
            };
            toolbar.appendChild(btn);
        });

        parent.appendChild(toolbar);
    }

    private setupToolbarUI() {
        const givebutterBtn = document.querySelector('.ql-givebutter');
        if (givebutterBtn) {
            givebutterBtn.setAttribute('data-title', "Insert Givebutter Widget");
            givebutterBtn.innerHTML = `
        <svg viewBox="0 0 18 18">
            <rect class="ql-stroke" height="14" width="14" x="2" y="2" rx="2" ry="2" stroke="#a855f7" fill="none" stroke-width="2"></rect>
            <path class="ql-fill" d="M6,7.5 A1.5,1.5 0 1,1 3,7.5 A1.5,1.5 0 1,1 6,7.5 Z" fill="#a855f7"></path>
            <line class="ql-stroke" x1="8" x2="14" y1="7" y2="7" stroke="#a855f7" stroke-width="2"></line>
            <line class="ql-stroke" x1="5" x2="13" y1="11" y2="11" stroke="#a855f7" stroke-width="2"></line>
        </svg>`;
        }

        const navPicker = document.querySelector('.ql-nav-link');
        if (navPicker) {
            navPicker.setAttribute('data-label', 'App Pages');
            navPicker.setAttribute("data-title", "Insert a link to an internal page");
        }

        const navItems = document.querySelectorAll('.ql-nav-link .ql-picker-item');
        navItems.forEach(item => {
            const val = item.getAttribute('data-value');
            if (val) item.textContent = val;
        });

        const externalLink = document.querySelector(".ql-link");
        if (externalLink) externalLink.setAttribute('data-title', "Insert an external link");

        const actionBtn = document.querySelector('.ql-action-link');
        if (actionBtn) {
            actionBtn.setAttribute('data-title', "Insert an action link");
            actionBtn.innerHTML = `<svg viewBox="0 0 18 18"><rect class="ql-stroke" height="10" width="14" x="2" y="4" rx="2" ry="2"></rect><line class="ql-stroke" x1="7" x2="11" y1="9" y2="9"></line></svg>`;
        }

        const imageBtn = document.querySelector('.ql-image');
        if (imageBtn) {
            imageBtn.setAttribute("data-title", "Upload Image");
        }

        const videoBtn = document.querySelector(".ql-video");
        if (videoBtn) videoBtn.setAttribute("data-title", "Insert a Youtube video");

        const mailtoBtn = document.querySelector('.ql-mailto');
        if (mailtoBtn) {
            mailtoBtn.setAttribute('data-title', "Insert Email Link");
            mailtoBtn.innerHTML = `
            <svg viewBox="0 0 18 18">
                <polyline class="ql-stroke" points="2 4 9 11 16 4"></polyline>
                <rect class="ql-stroke" height="10" width="14" x="2" y="4" rx="1" ry="1"></rect>
            </svg>`;
        }

        const tableBtn = document.querySelector('.ql-table');
        if (tableBtn) {
            tableBtn.setAttribute('data-title', 'Insert 2-Column Block Layout');
            tableBtn.innerHTML = `
                <svg viewBox="0 0 18 18">
                    <rect class="ql-stroke" height="14" width="6" x="2" y="2" rx="1" ry="1"></rect>
                    <rect class="ql-stroke" height="14" width="6" x="10" y="2" rx="1" ry="1"></rect>
                </svg>`;
        }

        const cleanBtn = document.querySelector(".ql-clean");
        if (cleanBtn) cleanBtn.setAttribute("data-title", "Clear all formatting for selection");
    }

    private setupDeleteObserver() {
        this.trackedImages = new Set(this.getImagesFromEditor());
        this.deleteObserver = new MutationObserver(() => {
            const newImages = new Set(this.getImagesFromEditor());
            for (const url of this.trackedImages) {
                if (!newImages.has(url)) {
                    if (url.includes('photos.guatemaltausa.org')) {
                        this.deletedImageURLs.push(url);
                    }
                }
            }
            this.trackedImages = newImages;
        });
        this.deleteObserver.observe(this.quill.root, { childList: true, subtree: true });
    }

    private getImagesFromEditor(): string[] {
        const imgs = this.quill.root.querySelectorAll('img');
        return Array.from(imgs).map(img => img.src).filter(src => src.includes('guatemaltausa.org'));
    }

    private extractImagesFromOps(ops: any[]): string[] {
        if (!Array.isArray(ops)) return [];
        return ops
            .filter(op => op.insert && typeof op.insert === 'object' && op.insert.image)
            .map(op => op.insert.image as string)
            .filter(src => typeof src === 'string' && src.includes('guatemaltausa.org'));
    }

    private async selectLocalImage() {
        const savedRange = this.quill.getSelection();
        if (!savedRange) {
            createMessage({ messageBody: "Please click inside the editor or a block column first.", location: "main-message", type: "error" });
            return;
        }

        const input = document.createElement('input');
        input.setAttribute('type', 'file');
        input.setAttribute('accept', 'image/*');
        input.click();

        input.onchange = async () => {
            const file = input.files?.[0];
            if (!file) return;

            const options = { maxSizeMB: 0.8, maxWidthOrHeight: 1200, useWebWorker: true, fileType: 'image/jpeg' };

            try {
                const compressedFile = await imageCompression(file, options);
                const response = await fetch('https://photo-upload.guatemaltausa.workers.dev', {
                    method: 'POST',
                    body: compressedFile,
                    headers: { 'Content-Type': 'image/jpeg' }
                });

                if (!response.ok) throw new Error(`Worker Error ${response.status}`);
                const data = await response.json();

                if (data.url) {
                    this.quill.insertEmbed(savedRange.index, 'image', data.url);
                    this.quill.setSelection(savedRange.index + 1);
                    createMessage({ messageBody: "Image uploaded successfully!", location: "main-message", type: "check_circle" });

                    const altTextResponse = await promptModal(
                        "Please provide a description for this image",
                        ["Image Description..."],
                        "Add Description",
                        true
                    );

                    if (altTextResponse) {
                        const altText = altTextResponse[0];
                        if (altText && altText.trim() !== "") {
                            const [leaf] = this.quill.getLeaf(savedRange.index) as [any, number];
                            if (leaf && typeof leaf.format === 'function') {
                                leaf.format('alt', altText.trim());
                            }
                        }
                    }
                }
            } catch (error) {
                createMessage({ messageBody: "Upload failed.", location: "main-message", type: "error" });
            }
        };
    }

    public async prepareContentForSave(): Promise<{ en: any[]; es: any[] }> {
        // Sync current active editor content
        const currentOps = this.quill.getContents().ops;
        this.contentState[this.currentTab] = Array.isArray(currentOps) ? currentOps : [];

        const sanitizeOps = (data: any): any[] => {
            if (!data) return [];
            if (Array.isArray(data)) return data;
            if (Array.isArray(data.ops)) return data.ops;
            if (Array.isArray(data.en)) return data.en;
            return [];
        };

        const cleanEn = sanitizeOps(this.contentState.en);
        const cleanEs = sanitizeOps(this.contentState.es);

        const enImages = this.extractImagesFromOps(cleanEn);
        const esImages = this.extractImagesFromOps(cleanEs);
        const finalImages = new Set([...enImages, ...esImages]);

        const trueDeletions = this.deletedImageURLs.filter(url => !finalImages.has(url));

        if (trueDeletions.length > 0) {
            try {
                const deletePromises = trueDeletions.map(url => {
                    const filename = url.split('/').pop();
                    return fetch(`https://photo-upload.guatemaltausa.workers.dev?filename=${filename}`, { method: 'DELETE' });
                });
                await Promise.all(deletePromises);
            } catch (err) {
                console.error("R2 cleanup failed:", err);
            }
            this.deletedImageURLs = [];
        }

        return {
            en: cleanEn,
            es: cleanEs
        };
    }

    async load(pageName: string): Promise<void> {
        this.currentPage = pageName;
        try {
            const data = await getPageContents(pageName);

            if (this.deleteObserver) this.deleteObserver.disconnect();

            if (data && data.content) {
                this.contentState = {
                    en: extractOps(data.content.en),
                    es: extractOps(data.content.es)
                };
            } else {
                this.contentState = { en: [], es: [] };
            }

            let initialOps = this.contentState[this.currentTab];
            if (this.currentTab === 'es' && isEmptyDelta(initialOps)) {
                initialOps = this.contentState.en;
            }

            this.quill.setContents((initialOps || []) as any);

            this.trackedImages = new Set(this.getImagesFromEditor());
            this.deletedImageURLs = [];
            if (this.deleteObserver) {
                this.deleteObserver.observe(this.quill.root, { childList: true, subtree: true });
            }

            const lastUpdatedDiv = document.getElementById("last-updated");
            if (lastUpdatedDiv && data?.lastUpdated) {
                lastUpdatedDiv.innerHTML = "";
                const date = data.lastUpdated.toDate();
                const lastUpdatedP = makeElement("p", null, null, i18n.t('last_updated', { timestamp: formatDate(date, true) }));
                lastUpdatedDiv.appendChild(lastUpdatedP);
            }
        } catch (err) {
            console.error("Failed to load page content:", err);
        }
    }

    async save(): Promise<void> {
        if (!this.currentPage) return;
        try {
            const localizedContent = await this.prepareContentForSave();
            await updatePageContents(this.currentPage, { content: localizedContent });
            createMessage({ messageBody: "Changes saved!", location: "main-message", type: "check_circle" });
        } catch (err) {
            createMessage({ messageBody: "Error saving to database.", location: "main-message", type: "error" });
        }
    }

    public async deleteAllImages(): Promise<void> {
        const enImages = this.extractImagesFromOps(this.contentState.en);
        const esImages = this.extractImagesFromOps(this.contentState.es);
        const currentImages = this.getImagesFromEditor();
        const images = Array.from(new Set([...enImages, ...esImages, ...currentImages]));

        if (images.length === 0) return;

        try {
            const deletePromises = images.map(url => {
                const filename = url.split('/').pop();
                return fetch(`https://photo-upload.guatemaltausa.workers.dev?filename=${filename}`, {
                    method: 'DELETE'
                });
            });

            await Promise.all(deletePromises);
            console.log(`${images.length} images cleaned up from R2.`);
        } catch (err) {
            console.error("Failed to clean up images from R2:", err);
        }
    }

    public destroy(): void {
        if (this.deleteObserver) {
            this.deleteObserver.disconnect();
            this.deleteObserver = null;
        }
        this.activeImageElement = null;
    }

    public getHTML(): string {
        const rawHTML = this.quill.root.innerHTML;
        const cleaned = rawHTML.replace(/<[^>]*>/g, '').trim();

        if (cleaned.length === 0 && this.currentTab === 'es') {
            const fallbackOps = this.contentState.en;
            if (fallbackOps && !isEmptyDelta(fallbackOps)) {
                this.quill.setContents(fallbackOps as any);
                return this.quill.root.innerHTML;
            }
        }

        return rawHTML;
    }

    public setHTML(html: string): void { this.quill.root.innerHTML = html; }
}

updateContent();