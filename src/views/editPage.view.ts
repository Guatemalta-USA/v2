import { Timestamp } from 'firebase/firestore';
import type { SupportedLanguage, LocalizedContent, LocalizedString } from '../models/helper.model';
import { TheEditor } from '../modules/editor';
import { state } from '../modules/state.module';
import { storeMessage, createMessage, promptModal, confirmDeleteModal } from '../modules/utils';
import { router } from '../router';
import { getPageContents, updatePageContents, deletePageContents } from '../services/firebase.service.ts';
import htmlContent from './editPage.html?raw';
import { PageContents } from '../models/page.model.ts';

export async function renderEditPageView(container: HTMLElement, pageName?: string): Promise<string | undefined> {
    let documentId = pageName;
    let initialPageTitle = "";

    if (!documentId) {
        const promptResponse = await promptModal(
            "Enter new page path/name",
            ["e.g., terms and conditions, or about us"],
            "Create Page",
            false
        );

        if (!promptResponse || !promptResponse[0]?.trim()) {
            router.navigateTo("/impact");
            return;
        }

        initialPageTitle = promptResponse[0].trim();

        documentId = initialPageTitle
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');

        if (!documentId) {
            createMessage({ messageBody: "Invalid page name provided.", location: "main-message", type: "error" });
            router.navigateTo("/impact");
            return;
        }

        window.history.replaceState({}, '', `/pages/${documentId}/edit`);
    }

    state.setPageContext({
        page: pageName ? `Edit Page: ${documentId}` : `Create Page: ${documentId}`,
        parent: "impact"
    });

    container.innerHTML = htmlContent;

    let editor: TheEditor | null = null;
    let currentPageContents: PageContents | null = null;
    let activeLang: SupportedLanguage = 'en';
    let localizedTitles: LocalizedString = { en: '', es: '' };

    try {
        if (!state.currentUser || state.currentRole !== "admin") {
            createMessage({ messageBody: "Access denied. Admin privileges are required", location: "main-message", type: "error", i18n: "access_denied" });
            router.navigateTo("/impact");
            return documentId;
        }

        const editSection = document.getElementById('edit-section');
        if (editSection) {
            editSection.classList.remove('hide');
        }

        const editorContainer = document.getElementById('editor-container');
        if (!editorContainer) {
            console.error('[EditPageView] Could not find "#editor-container" in the DOM.');
            return documentId;
        }

        editor = new TheEditor();

        setupTabNavigation();
        setupSaveHandler();
        setupDeleteHandler();

        if (pageName) {
            await loadPageData(documentId);
        } else {
            localizedTitles = { en: initialPageTitle, es: '' };
            currentPageContents = new PageContents(localizedTitles, Timestamp.now(), { en: [], es: [] });
            
            syncLanguageUI('en');

            if (editor) {
                editor.currentPage = documentId;
                editor.setContentState({ en: [], es: [] });
            }
        }

        const deleteBtn = document.getElementById('delete-btn');
        if (deleteBtn && pageName) {
            deleteBtn.style.display = 'inline-flex';
        }

    } catch (err) {
        console.error("[EditPageView] Initialization failed:", err);
        createMessage({ messageBody: "Failed to load page editor.", location: "main-message", type: "error" });
    } finally {
        const loading = document.getElementById("loading");
        if (loading) loading.remove();
    }

    async function loadPageData(name: string): Promise<void> {
        try {
            const rawData = await getPageContents(name);

            if (rawData) {
                currentPageContents = PageContents.fromFirestore({
                    pageName: rawData.pageName || { en: name, es: '' },
                    lastUpdated: rawData.lastUpdated || Timestamp.now(),
                    content: rawData.content
                });
            } else {
                currentPageContents = new PageContents({ en: name, es: '' }, Timestamp.now(), { en: [], es: [] });
            }

            localizedTitles = {
                en: currentPageContents.pageName?.en || '',
                es: currentPageContents.pageName?.es || ''
            };

            if (editor && currentPageContents) {
                editor.currentPage = name;

                const normalizedContent: LocalizedContent = {
                    en: normalizeToDelta(currentPageContents.content.en),
                    es: normalizeToDelta(currentPageContents.content.es)
                };

                editor.setContentState(normalizedContent);
            }

            syncLanguageUI('en');
        } catch (error) {
            console.error("Error loading page contents:", error);
            createMessage({ messageBody: "Failed to load page contents.", location: "main-message", type: "error" });
        }
    }

    function normalizeToDelta(rawContent: string | any[] | Record<string, any> | undefined | null): any[] {
        if (!rawContent) return [];
        if (Array.isArray(rawContent)) return rawContent;
        if (typeof rawContent === 'object' && Array.isArray((rawContent as any).ops)) {
            return (rawContent as any).ops;
        }
        if (typeof rawContent === 'string') return [{ insert: rawContent }];
        return [];
    }

    function syncTitleInput(): void {
        const pageNameInput = document.getElementById('page-name-input') as HTMLInputElement | null;
        if (pageNameInput) {
            localizedTitles[activeLang] = pageNameInput.value.trim();
        }
    }

    function syncLanguageUI(lang: SupportedLanguage): void {
        activeLang = lang;

        const pageNameInput = document.getElementById('page-name-input') as HTMLInputElement | null;
        if (pageNameInput) {
            pageNameInput.value = localizedTitles[lang] || '';
        }

        if (editor) {
            const targetTab = (lang.slice(0, 2).toLowerCase() === 'es') ? 'es' : 'en';
            editor.switchLanguageTab(targetTab);
        }
    }

    function setupTabNavigation(): void {
        const btnEn = document.getElementById('tab-lang-en');
        const btnEs = document.getElementById('tab-lang-es');

        const handleTabSwitch = (targetLang: SupportedLanguage, targetBtn: HTMLElement, otherBtn: HTMLElement | null) => {
            if (activeLang === targetLang) return;

            syncTitleInput();

            targetBtn.classList.add('active');
            if (otherBtn) otherBtn.classList.remove('active');

            syncLanguageUI(targetLang);
        };

        if (btnEn) {
            btnEn.addEventListener('click', (e: Event) => {
                e.preventDefault();
                handleTabSwitch('en', btnEn, btnEs);
            });
        }

        if (btnEs) {
            btnEs.addEventListener('click', (e: Event) => {
                e.preventDefault();
                handleTabSwitch('es', btnEs, btnEn);
            });
        }
    }

    function setupSaveHandler(): void {
        const saveBtn = document.getElementById('save-btn');
        if (!saveBtn) return;

        saveBtn.addEventListener("click", async (e: Event) => {
            e.preventDefault();

            if (!currentPageContents || !documentId) {
                createMessage({ messageBody: "No active page loaded to save.", location: "main-message", type: "error" });
                return;
            }

            if (!editor) {
                createMessage({ messageBody: "Editor instance missing.", location: "main-message", type: "error" });
                return;
            }

            try {
                syncTitleInput();
                const localizedContents: LocalizedContent = await editor.prepareContentForSave();

                currentPageContents.pageName = localizedTitles;
                currentPageContents.content = localizedContents;
                currentPageContents.lastUpdated = Timestamp.now();

                await updatePageContents(documentId, currentPageContents);

                createMessage({ messageBody: "Page saved successfully.", location: "main-message", type: "check_circle" });

            } catch (error) {
                console.error("Failed to save page:", error);
                createMessage({ messageBody: "Error saving page changes.", location: "main-message", type: "error" });
            }
        });
    }

    function setupDeleteHandler(): void {
        const deleteBtn = document.getElementById('delete-btn');
        if (!deleteBtn) return;

        deleteBtn.addEventListener("click", async () => {
            if (!documentId) return;

            const pageTitle = currentPageContents?.pageName?.en || currentPageContents?.pageName?.es || documentId;
            const confirmed = await confirmDeleteModal(
                `Delete "${pageTitle}"?`,
                "This action cannot be undone."
            );

            if (confirmed) {
                try {
                    deleteBtn.innerText = "Deleting...";
                    (deleteBtn as HTMLButtonElement).disabled = true;

                    if (editor) {
                        await editor.deleteAllImages();
                    }

                    await deletePageContents(documentId);
                    storeMessage({ messageBody: "Page deleted successfully", location: "main-message", type: "delete" });
                    router.navigateTo('/impact');
                } catch (err) {
                    console.error("Delete failed:", err);
                    createMessage({ messageBody: "Failed to delete the page.", location: "main-message", type: "error" });
                    deleteBtn.innerText = "Delete Page";
                    (deleteBtn as HTMLButtonElement).disabled = false;
                }
            }
        });
    }

    return documentId;
}