import { state } from "../modules/state.module";
import { router } from "../router";
import i18n, { getResolvedLanguage, updateContent } from "../modules/i18n";
import { createButton, createMessage, formatDate, makeElement } from "../modules/utils";
import Quill from "quill";
import 'quill/dist/quill.snow.css';
import { getPageContents } from "../services/firebase.service.ts";
import htmlContent from "./dynamicPage.html?raw";

// Track language change listener for clean unsubscription
let dynamicPageLangListener: ((lng: string) => void) | null = null;

export async function renderDynamicPage(container: HTMLElement, pageId: string) {
    container.innerHTML = htmlContent;

    const loadingEl = document.getElementById("loading");
    const pageContainer = document.getElementById("page-container");
    const viewerContainer = document.getElementById("viewer-container");
    const lastUpdatedEl = document.getElementById("lastUpdated");
    const adminActionsEl = document.getElementById("admin-actions");

    try {
        const pageData = await getPageContents(pageId);
        if (!pageData) {
            createMessage({ messageBody: "Page not found.", location: "main-message", type: "error" });
            router.navigateTo("/");
            return;
        }

        const renderPageContent = async () => {
            const lang = (getResolvedLanguage() || 'en').slice(0, 2) === 'es' ? 'es' : 'en';

            // Helper to check if a content/title value is effectively empty
            const hasContent = (val: any): boolean => {
                if (!val) return false;
                if (typeof val === 'string' && val.trim() !== '') return true;
                if (Array.isArray(val) && val.length > 0) {
                    // Check if array has more than just an empty newline insert
                    return !(val.length === 1 && val[0].insert === '\n');
                }
                if (typeof val === 'object') {
                    if (Array.isArray(val.ops) && val.ops.length > 0) {
                        return !(val.ops.length === 1 && val.ops[0].insert === '\n');
                    }
                    if (val.en || val.es) {
                        return hasContent(val[lang]) || hasContent(val['en']);
                    }
                }
                return false;
            };

            // 1. Resolve Localized Title with English Fallback
            let titleText = pageId;
            if (typeof pageData.pageName === 'object' && pageData.pageName !== null) {
                const requestedTitle = pageData.pageName[lang];
                const englishTitle = pageData.pageName['en'];
                titleText = (lang === 'es' && hasContent(requestedTitle)) ? requestedTitle : (englishTitle || pageId);
            } else if (typeof pageData.pageName === 'string') {
                titleText = pageData.pageName;
            }

            const displayTitleEl = document.getElementById("display-title");
            if (displayTitleEl) {
                displayTitleEl.textContent = titleText;
            }
            state.setPageContext({ parent: "pages", page: titleText });

            // 2. Render Read-Only Quill Content with English Fallback
            if (viewerContainer) {
                viewerContainer.innerHTML = '';
                const quillContainer = document.createElement('div');
                viewerContainer.appendChild(quillContainer);

                let rawContent = [];
                if (typeof pageData.content === 'object' && pageData.content !== null) {
                    const requestedContent = pageData.content[lang];
                    const englishContent = pageData.content['en'];
                    
                    rawContent = (lang === 'es' && hasContent(requestedContent)) ? requestedContent : (englishContent || []);
                } else {
                    rawContent = pageData.content;
                }

                // Safely unwrap Quill Delta formats or raw arrays from Firestore
                let ops = [];
                if (Array.isArray(rawContent)) {
                    ops = rawContent;
                } else if (rawContent && typeof rawContent === 'object') {
                    if (Array.isArray((rawContent as any).ops)) {
                        ops = (rawContent as any).ops;
                    } else {
                        // Fallback if stored as a single delta object or string
                        ops = [{ insert: JSON.stringify(rawContent) }];
                    }
                } else if (typeof rawContent === 'string') {
                    ops = [{ insert: rawContent }];
                }

                const readOnlyQuill = new Quill(quillContainer, {
                    theme: 'snow',
                    readOnly: true,
                    modules: { toolbar: false }
                });
                readOnlyQuill.setContents(ops);
            }

            // 3. Render Last Updated Timestamp
            if (lastUpdatedEl && pageData.lastUpdated) {
                lastUpdatedEl.innerHTML = '';
                const rawDate = pageData.lastUpdated;
                const date = ('toDate' in rawDate && typeof (rawDate as any).toDate === 'function')
                    ? (rawDate as any).toDate()
                    : new Date(rawDate as unknown as string);

                const lastUpdatedP = makeElement("p", null, null, i18n.t('last_updated', { timestamp: formatDate(date, true) }));
                lastUpdatedEl.appendChild(lastUpdatedP);
            }

            // 4. Render Admin Actions (Edit Page Button)
            if (adminActionsEl) {
                adminActionsEl.innerHTML = '';
                if (state.currentRole === 'admin') {
                    adminActionsEl.classList.remove('hide');
                    const editBtn = createButton({
                        buttonText: "Edit Page",
                        buttonId: "edit-page",
                        buttonType: "button",
                        buttonClass: "accent-button",
                        icon: "edit",
                        i18n: "button_edit"
                    });
                    editBtn.onclick = () => {
                        router.navigateTo(`/${pageId}/edit`);
                    };
                    adminActionsEl.appendChild(editBtn);
                } else {
                    adminActionsEl.classList.add('hide');
                }
            }
        };

        // Initial render pass
        await renderPageContent();

        // Subscribe to language changes for instant translation switching
        if (dynamicPageLangListener) {
            i18n.off("languageChanged", dynamicPageLangListener);
        }
        dynamicPageLangListener = () => {
            renderPageContent();
        };
        i18n.on("languageChanged", dynamicPageLangListener);

    } catch (error) {
        console.error("Error loading dynamic page:", error);
        createMessage({ messageBody: "Failed to load page contents.", location: "main-message", type: "error" });
    } finally {
        if (loadingEl) loadingEl.remove();
        if (pageContainer) pageContainer.classList.remove("hide");
        updateContent();
    }
}