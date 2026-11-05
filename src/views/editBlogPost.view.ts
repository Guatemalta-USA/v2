import { Timestamp } from 'firebase/firestore';
import type { SupportedLanguage, LocalizedString, LocalizedContent } from '../models/helper.model';
import { Post } from '../models/post.model';
import type { Project } from '../models/project.model';
import { TheEditor } from '../modules/editor';
import { state } from '../modules/state.module';
import { storeMessage, createMessage, confirmDeleteModal } from '../modules/utils';
import { router } from '../router';
import { getAllProjects, getPostById, savePost, deletePost } from '../services/firebase.service.ts';
import htmlContent from './editBlogPost.html?raw';

export async function renderEditPostView(container: HTMLElement, postId?: string): Promise<void> {
    state.setPageContext({ 
        page: postId ? "Edit Post" : "Create Post", 
        parent: "blog" 
    });

    container.innerHTML = htmlContent;

    let editor: TheEditor | null = null;
    let currentPost: Post | null = null;
    let activeLang: SupportedLanguage = 'en';
    let localizedTitles: LocalizedString = { en: '', es: '' };
    let postAuthor: string = "";

    try {
        if (!state.currentUser) {
            createMessage({ messageBody: "Access denied. Admin privileges are required", location: "main-message", type: "error", i18n: "access_denied" });
            router.navigateTo(`/blog/${postId}`);
            return;
        }

        if (state.currentRole !== "admin") {
            createMessage({ messageBody: "Access denied. Admin privileges are required", location: "main-message", type: "error", i18n: "access_denied" });
            router.navigateTo(`/blog/${postId}`);
            return;
        }

        const editSection = document.getElementById('edit-section');
        if (editSection) {
            editSection.classList.remove('hide');
        }

        await loadProjectOptions();

        const editorContainer = document.getElementById('editor-container');
        if (!editorContainer) {
            console.error('[EditPostView] Could not find "#editor-container" in the DOM.');
            return;
        }

        editor = new TheEditor();

        setupTabNavigation();
        setupSaveHandler();
        setupDeleteHandler();

        if (postId) {
            await loadPostData(postId);
        } else {
            currentPost = new Post(
                { en: '', es: '' },
                "",
                Timestamp.now(),
                Timestamp.now(),
                { en: [], es: [] },
                ""
            );
            syncLanguageUI('en');
        }

    } catch (err) {
        console.error("[EditPostView] Initialization failed:", err);
        createMessage({ messageBody: "Failed to load page editor.", location: "main-message", type: "error" });
    } finally {
        const loading = document.getElementById("loading");
        if (loading) loading.remove();
    }

    async function loadProjectOptions(): Promise<void> {
        const linkToProjectSelect = document.getElementById('link-to-project') as HTMLSelectElement | null;
        if (!linkToProjectSelect) return;

        linkToProjectSelect.innerHTML = '';

        const none = document.createElement("option");
        none.text = "None";
        none.value = "";
        linkToProjectSelect.add(none);

        try {
            const projects: Project[] = await getAllProjects();
            projects.forEach((project) => {
                const option = document.createElement("option");
                option.text = typeof project.projectTitle === 'object' ? project.projectTitle.en : project.projectTitle;
                if (project.id) option.value = project.id;
                linkToProjectSelect.add(option);
            });
        } catch (err) {
            console.error("Error loading projects:", err);
        }
    }

    async function loadPostData(id: string): Promise<void> {
        try {
            currentPost = await getPostById(id);

            if (!currentPost) {
                createMessage({ messageBody: "Post not found.", location: "main-message", type: "error" });
                return;
            }

            localizedTitles = {
                en: currentPost.postTitle?.en || '',
                es: currentPost.postTitle?.es || ''
            };

            postAuthor = currentPost.author || '';

            const authorInput = document.getElementById('author-input') as HTMLInputElement | null;
            if (authorInput) {
                authorInput.value = postAuthor;
            }

            const selectProject = document.getElementById('link-to-project') as HTMLSelectElement | null;
            if (selectProject && currentPost.linkedProjectId) {
                selectProject.value = currentPost.linkedProjectId;
            }

            if (editor && currentPost.content) {
                editor.currentPage = id;

                const normalizedContent: LocalizedContent = {
                    en: normalizeToDelta(currentPost.content.en),
                    es: normalizeToDelta(currentPost.content.es)
                };

                editor.setContentState(normalizedContent);
            }

            const deleteBtn = document.getElementById('delete-btn');
            if (deleteBtn) {
                deleteBtn.style.display = 'inline-block';
            }

            syncLanguageUI('en');
        } catch (error) {
            console.error("Error loading post by ID:", error);
            createMessage({ messageBody: "Failed to load post details.", location: "main-message", type: "error" });
        }
    }

    function normalizeToDelta(rawContent: string | any[] | undefined | null): any[] {
        if (!rawContent) return [];
        if (Array.isArray(rawContent)) return rawContent;
        if (typeof rawContent === 'string') return [{ insert: rawContent }];
        return [];
    }

    function syncMetaData(): void {
        const titleInput = document.getElementById('post-title-input') as HTMLInputElement | null;
        if (titleInput) {
            localizedTitles[activeLang] = titleInput.value.trim();
        }

        const authorInput = document.getElementById('author-input') as HTMLInputElement | null;
        if (authorInput) {
            postAuthor = authorInput.value.trim();
        }
    }

    function syncLanguageUI(lang: SupportedLanguage): void {
        activeLang = lang;

        const titleInput = document.getElementById('post-title-input') as HTMLInputElement | null;
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

            syncMetaData();

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

            if (!currentPost) {
                createMessage({ messageBody: "No active post loaded to save.", location: "main-message", type: "error" });
                return;
            }

            if (!editor) {
                createMessage({ messageBody: "Editor instance missing.", location: "main-message", type: "error" });
                return;
            }

            try {
                syncMetaData();

                const selectProject = document.getElementById('link-to-project') as HTMLSelectElement | null;
                const linkedProjectId = selectProject ? selectProject.value : '';

                const localizedContents: LocalizedContent = await editor.prepareContentForSave();

                const postToSave = new Post(
                    localizedTitles,
                    postAuthor,
                    currentPost?.publishDate ?? Timestamp.now(),
                    Timestamp.now(),
                    localizedContents,
                    linkedProjectId
                );

                if (postId) {
                    postToSave.id = postId;
                }

                const savedId = await savePost(postToSave);

                if (!postId) {
                    postId = savedId;
                    postToSave.id = savedId;
                    currentPost = postToSave;
                    if (editor) {
                        editor.currentPage = savedId;
                    }
                    // Update URL path using router / history replace without full reload
                    window.history.replaceState({}, '', `/blog/${savedId}/edit`);

                    const deleteBtn = document.getElementById('delete-btn');
                    if (deleteBtn) deleteBtn.style.display = 'inline-block';
                }

                createMessage({ messageBody: "Post saved successfully.", location: "main-message", type: "check_circle" });

            } catch (error) {
                console.error("Failed to save post:", error);
                createMessage({ messageBody: "Error saving post changes.", location: "main-message", type: "error" });
            }
        });
    }

    function setupDeleteHandler(): void {
        const deleteBtn = document.getElementById('delete-btn');
        if (!deleteBtn) return;

        deleteBtn.style.display = postId ? 'inline-block' : 'none';

        deleteBtn.addEventListener("click", async () => {
            if (!postId) {
                console.warn("Delete blocked: No valid postId found.");
                return;
            }

            const postTitle = localizedTitles[activeLang] || 'Post';

            const confirmed = await confirmDeleteModal(
                `Delete "${postTitle}"?`,
                "Deleting this post will also delete its photos. This action can not be undone"
            );

            if (confirmed) {
                try {
                    deleteBtn.innerText = "Deleting...";
                    (deleteBtn as HTMLButtonElement).disabled = true;

                    if (editor) {
                        await editor.deleteAllImages();
                    }

                    await deletePost(postId);
                    storeMessage({ messageBody: "Post deleted successfully", location: "main-message", type: "delete" });
                    router.navigateTo('/blog');
                } catch (err) {
                    console.error("Delete failed:", err);
                    createMessage({ messageBody: "Failed to delete the post. Please try again.", location: "main-message", type: "error" });
                    deleteBtn.innerText = "Delete Post";
                    (deleteBtn as HTMLButtonElement).disabled = false;
                }
            }
        });
    }
}