import { state } from "../modules/state.module";
import { router } from "../router";
import i18n, { getResolvedLanguage, updateContent } from "../modules/i18n";
import { createButton, createMessage, formatDate } from "../modules/utils";
import Quill from "quill";
import 'quill/dist/quill.snow.css';
import htmlContent from "./blogPost.html?raw";
import { getPostById } from "../services/firebase.service.ts";

// Track language change listener
let blogLangListener: ((lng: string) => void) | null = null;

export async function renderBlogPost(container: HTMLElement, postId: string) {
    container.innerHTML = htmlContent;

    const loadingEl = document.getElementById("loading");
    const postContainer = document.getElementById("post-container") as HTMLElement;
    const titleEl = document.getElementById("display-title") as HTMLElement;
    const postInfo = document.getElementById("post-info") as HTMLElement;
    const contentEl = document.getElementById("viewer-container");
    const adminActionsEl = document.getElementById("admin-actions");
    const lastUpdatedEl = document.getElementById("lastUpdated") as HTMLElement;

    try {
        const post = await getPostById(postId);
        if (!post) {
            createMessage({ messageBody: "Post not found.", location: "main-message", type: "error" });
            router.navigateTo("/blog");
            return;
        }

        const renderPostContent = () => {
            const lang = (getResolvedLanguage() || 'en').slice(0, 2) === 'es' ? 'es' : 'en';

            // 1. Set Title & Document Context
            const titleText = post.postTitle[lang] || post.postTitle['en'] || "Blog Post";
            if (titleEl) {
                titleEl.textContent = titleText;
            }
            state.setPageContext({ parent: "blog", page: titleText });

            // 2. Set Author & Publish Date
            if (postInfo && post.author && post.publishDate) {
                const rawDate = post.publishDate;
                const date: Date = ('toDate' in rawDate && typeof (rawDate as any).toDate === 'function')
                    ? (rawDate as any).toDate()
                    : new Date(rawDate as unknown as string);
                postInfo.textContent = `By ${post.author} on ${formatDate(date, false)}`
            }

            if (lastUpdatedEl) {
                lastUpdatedEl.innerText = i18n.t('last_updated', { timestamp: formatDate(post.lastUpdated, true) });
            }

            // 3. Render Quill Content in Read-Only Mode
            if (contentEl) {
                contentEl.innerHTML = '';
                const quillContainer = document.createElement('div');
                contentEl.appendChild(quillContainer);

                const rawContent = post.content[lang] || post.content['en'] || [];
                const ops = Array.isArray(rawContent) ? rawContent : [{ insert: rawContent }];

                // Initialize a read-only Quill instance to render formatted text, tables, and images safely
                const readOnlyQuill = new Quill(quillContainer, {
                    theme: 'snow',
                    readOnly: true,
                    modules: { toolbar: false }
                });
                readOnlyQuill.setContents(ops);
            }

            // 4. Render Admin Edit Button if user is an admin
            if (adminActionsEl) {
                adminActionsEl.innerHTML = '';
                if (state.currentRole === 'admin') {
                    const editBtn = createButton({
                        buttonText: "Edit Post",
                        buttonId: "edit-post",
                        buttonType: "button",
                        buttonClass: "accent-button",
                        icon: "edit",
                        i18n: "button_edit"
                    });

                    editBtn.onclick = () => {
                        router.navigateTo(`/blog/${postId}/edit`);
                    };
                    adminActionsEl.appendChild(editBtn);
                }
            }
        };

        // Initial render pass
        renderPostContent();

        // Subscribe to language changes so the post translates instantly when toggled
        if (blogLangListener) {
            i18n.off("languageChanged", blogLangListener);
        }
        blogLangListener = () => {
            renderPostContent();
        };
        i18n.on("languageChanged", blogLangListener);

    } catch (error) {
        console.error("Error loading blog post:", error);
        createMessage({ messageBody: "Failed to load blog post.", location: "main-message", type: "error" });
    } finally {
        if (loadingEl) loadingEl.remove();
        updateContent();
        if (postContainer) postContainer.classList.remove("hide");
        if (adminActionsEl) adminActionsEl.classList.remove("hide");
    }
}