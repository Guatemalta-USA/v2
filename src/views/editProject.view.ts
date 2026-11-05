import { Timestamp } from 'firebase/firestore';
import type { SupportedLanguage, LocalizedString, LocalizedContent } from '../models/helper.model';
import { Project } from '../models/project.model';
import { TheEditor } from '../modules/editor';
import { state } from '../modules/state.module';
import { storeMessage, createMessage, confirmDeleteModal } from '../modules/utils';
import { router } from '../router';
import { getProjectById, saveProject, deleteProject } from '../services/firebase.service.ts';
import htmlContent from './editProject.html?raw';

export async function renderEditProjectView(container: HTMLElement, projectId?: string): Promise<void> {
    state.setPageContext({ 
        page: projectId ? "Edit Project" : "Create Project", 
        parent: "impact" 
    });

    container.innerHTML = htmlContent;

    let editor: TheEditor | null = null;
    let currentProject: Project | null = null;
    let activeLang: SupportedLanguage = 'en';
    let localizedTitles: LocalizedString = { en: '', es: '' };

    try {
        if (!state.currentUser || state.currentRole !== "admin") {
            createMessage({ messageBody: "Access denied. Admin privileges are required", location: "main-message", type: "error", i18n: "access_denied" });
            router.navigateTo("/impact");
            return;
        }

        const editSection = document.getElementById('edit-section');
        if (editSection) {
            editSection.classList.remove('hide');
        }

        const editorContainer = document.getElementById('editor-container');
        if (!editorContainer) {
            console.error('[EditProjectView] Could not find "#editor-container" in the DOM.');
            return;
        }

        editor = new TheEditor();

        setupTabNavigation();
        setupSaveHandler();
        setupDeleteHandler();
        setUpCheckboxes();

        if (projectId) {
            await loadProjectData(projectId);
        } else {
            currentProject = new Project(
                { en: '', es: '' },
                { en: [], es: [] },
                true,
                false,
                null,
                0,
                "",
                Timestamp.now()
            );
            syncLanguageUI('en');
        }

    } catch (err) {
        console.error("[EditProjectView] Initialization failed:", err);
        createMessage({ messageBody: "Failed to load page editor.", location: "main-message", type: "error" });
    } finally {
        const loading = document.getElementById("loading");
        if (loading) loading.remove();
    }

    async function loadProjectData(id: string): Promise<void> {
        try {
            currentProject = await getProjectById(id);

            if (!currentProject) {
                createMessage({ messageBody: "Project not found.", location: "main-message", type: "error" });
                return;
            }

            localizedTitles = {
                en: currentProject.projectTitle?.en || '',
                es: currentProject.projectTitle?.es || ''
            };

            // Sync Current / Past status toggle & label
            const statusToggle = document.getElementById('project-status-toggle') as HTMLInputElement | null;
            if (statusToggle) {
                statusToggle.checked = Boolean(currentProject.isCurrent);
                const currentLabel = document.getElementById("current-status-label") as HTMLElement | null;
                if (currentLabel) {
                    currentLabel.textContent = currentProject.isCurrent ? "Current Project" : "Past Project";
                }
            }

            // Sync Published / Unpublished toggle & label
            const publishedToggle = document.getElementById('published-toggle') as HTMLInputElement | null;
            if (publishedToggle) {
                publishedToggle.checked = Boolean(currentProject.published);
                const publishedLabel = document.getElementById("published-label") as HTMLElement | null;
                if (publishedLabel) {
                    publishedLabel.textContent = currentProject.published ? "Published" : "Unpublished";
                }
            }

            if (editor && currentProject.content) {
                editor.currentPage = id;

                const normalizedContent: LocalizedContent = {
                    en: normalizeToDelta(currentProject.content.en),
                    es: normalizeToDelta(currentProject.content.es)
                };

                editor.setContentState(normalizedContent);
            }

            const deleteBtn = document.getElementById('delete-btn');
            if (deleteBtn) {
                deleteBtn.style.display = 'inline-block';
            }

            syncLanguageUI('en');
        } catch (error) {
            console.error("Error loading project by ID:", error);
            createMessage({ messageBody: "Failed to load project details.", location: "main-message", type: "error" });
        }
    }

    function normalizeToDelta(rawContent: any): any[] {
        if (!rawContent) return [];
        if (Array.isArray(rawContent)) return rawContent;
        if (typeof rawContent === 'object' && Array.isArray(rawContent.ops)) {
            return rawContent.ops;
        }
        if (typeof rawContent === 'string') {
            return [{ insert: rawContent }];
        }
        return [];
    }

    function syncTitleInput(): void {
        const titleInput = document.getElementById('project-title-input') as HTMLInputElement | null;
        if (titleInput) {
            localizedTitles[activeLang] = titleInput.value.trim();
        }
    }

    function syncLanguageUI(lang: SupportedLanguage): void {
        activeLang = lang;

        const titleInput = document.getElementById('project-title-input') as HTMLInputElement | null;
        if (titleInput) {
            titleInput.value = localizedTitles[lang] || '';
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

    function setUpCheckboxes(): void {
        const projectStatusCheckbox = document.getElementById("project-status-toggle") as HTMLInputElement | null;
        const projectPublishedCheckbox = document.getElementById("published-toggle") as HTMLInputElement | null;

        if (projectStatusCheckbox) {
            projectStatusCheckbox.addEventListener("change", (e) => {
                const target = e.target as HTMLInputElement;
                const currentLabel = document.getElementById("current-status-label") as HTMLElement | null;
                if (currentProject) {
                    currentProject.isCurrent = target.checked;
                    if (currentLabel) {
                        currentLabel.textContent = target.checked ? "Current Project" : "Past Project";
                    }
                }
            });
        }

        if (projectPublishedCheckbox) {
            projectPublishedCheckbox.addEventListener("change", (e) => {
                const target = e.target as HTMLInputElement;
                const publishedLabel = document.getElementById("published-label") as HTMLElement | null;
                if (currentProject) {
                    currentProject.published = target.checked;
                    if (publishedLabel) {
                        publishedLabel.textContent = target.checked ? "Published" : "Unpublished";
                    }
                }
            });
        }
    }

    function setupSaveHandler(): void {
        const saveBtn = document.getElementById('save-btn');
        if (!saveBtn) return;

        saveBtn.addEventListener("click", async (e: Event) => {
            e.preventDefault();

            if (!currentProject) {
                createMessage({ messageBody: "No active project loaded to save.", location: "main-message", type: "error" });
                return;
            }

            if (!editor) {
                createMessage({ messageBody: "Editor instance missing.", location: "main-message", type: "error" });
                return;
            }

            try {
                syncTitleInput();

                const localizedContents: LocalizedContent = await editor.prepareContentForSave();

                const projectToSave = new Project(
                    localizedTitles,
                    localizedContents,
                    currentProject.isCurrent,
                    currentProject.published,
                    currentProject.goalBar,
                    currentProject.orderIndex,
                    "",
                    Timestamp.now()
                );

                if (projectId) {
                    projectToSave.id = projectId;
                }

                const savedId = await saveProject(projectToSave);

                if (!projectId) {
                    projectId = savedId;
                    projectToSave.id = savedId;
                    currentProject = projectToSave;
                    if (editor) {
                        editor.currentPage = savedId;
                    }
                    window.history.replaceState({}, '', `/impact/${savedId}/edit`);

                    const deleteBtn = document.getElementById('delete-btn');
                    if (deleteBtn) deleteBtn.style.display = 'inline-block';
                }

                createMessage({ messageBody: "Project saved successfully.", location: "main-message", type: "check_circle" });

            } catch (error) {
                console.error("Failed to save project:", error);
                createMessage({ messageBody: "Error saving project changes.", location: "main-message", type: "error" });
            }
        });
    }

    function setupDeleteHandler(): void {
        const deleteBtn = document.getElementById('delete-btn');
        if (!deleteBtn) return;

        deleteBtn.style.display = projectId ? 'inline-block' : 'none';

        deleteBtn.addEventListener("click", async () => {
            if (!projectId) {
                console.warn("Delete blocked: No valid projectId found.");
                return;
            }

            const projectTitle = localizedTitles[activeLang] || 'Project';

            const confirmed = await confirmDeleteModal(
                `Delete "${projectTitle}"?`,
                "Deleting this project will also delete its photos. This action cannot be undone."
            );

            if (confirmed) {
                try {
                    deleteBtn.innerText = "Deleting...";
                    (deleteBtn as HTMLButtonElement).disabled = true;

                    if (editor) {
                        await editor.deleteAllImages();
                    }

                    await deleteProject(projectId);
                    storeMessage({ messageBody: "Project deleted successfully", location: "main-message", type: "delete" });
                    router.navigateTo('/impact');
                } catch (err) {
                    console.error("Delete failed:", err);
                    createMessage({ messageBody: "Failed to delete the project. Please try again.", location: "main-message", type: "error" });
                    deleteBtn.innerText = "Delete Project";
                    (deleteBtn as HTMLButtonElement).disabled = false;
                }
            }
        });
    }
}