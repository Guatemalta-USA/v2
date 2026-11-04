import type { Post } from "../models/post.model";
import i18n, { getResolvedLanguage, updateContent } from "../modules/i18n";
import { createButton, createLink, formatDate, makeElement } from "../modules/utils";
import { router } from "../router";
import { getUserRole } from "../services/auth.service.ts";
import { auth } from "../services/firebase";
import { getAllPosts } from "../services/firebase.service.ts";
import htmlContent from "./blog.html?raw";

export async function renderBlogPage(mainElement: HTMLElement) {
    mainElement.innerHTML = htmlContent;

    const container = document.getElementById('blog-posts-container') as HTMLElement;
    const loading = document.getElementById("loading");

    let posts: Post[] = [];

    function getCurrentLang(): 'en' | 'es' {
        const lang = getResolvedLanguage() || i18n.language || document.documentElement.lang || 'en';
        return lang.slice(0, 2) as 'en' | 'es';
    }

    function getExcerpt(post: Post, lang: 'en' | 'es'): string {
        if (typeof post.getFirstParagraph === "function") {
            const result = post.getFirstParagraph(lang);
            if (result && result.trim() !== "") return result;
        }

        // Fallback if post class instance methods aren't instantiated
        const rawContent = post.content?.[lang];
        if (typeof rawContent === 'string' && rawContent.trim() !== '') {
            try {
                const parsed = JSON.parse(rawContent);
                if (parsed.ops && Array.isArray(parsed.ops)) {
                    const text = parsed.ops
                        .map((op: any) => (typeof op.insert === 'string' ? op.insert : ''))
                        .join('')
                        .trim();
                    const firstPara = text.split('\n').find((p: string) => p.trim().length > 0);
                    if (firstPara) return firstPara;
                }
            } catch {
                return rawContent.split('\n')[0];
            }
        }
        return "";
    }

    function updateLocalizedPostElements() {
        const currentLang = getCurrentLang();

        const titleElements = document.querySelectorAll<HTMLElement>('[data-title-en]');
        titleElements.forEach((elem) => {
            const en = elem.getAttribute('data-title-en') || '';
            const es = elem.getAttribute('data-title-es') || '';
            elem.innerText = currentLang === 'es' && es ? es : en;
        });

        const excerptElements = document.querySelectorAll<HTMLElement>('[data-excerpt-en]');
        excerptElements.forEach((elem) => {
            const en = elem.getAttribute('data-excerpt-en') || '';
            const es = elem.getAttribute('data-excerpt-es') || '';
            elem.innerText = currentLang === 'es' && es ? es : en;
        });
    }

    async function loadPosts() {
        if (!container) return;
        container.innerHTML = "";
        const currentLang = getCurrentLang();

        try {
            if (posts.length === 0) {
                const noPosts = makeElement("p", null, null, i18n.t("no_posts_yet") || "No posts yet. Check back soon!");
                container.appendChild(noPosts);
            } else {
                const postsDiv = posts.reduce((acc: HTMLElement, post: Post) => {
                    const postId = post.id ? post.id : "";
                    const postArticle = makeElement("article", postId, "", null);
                    const postLink = makeElement("a", null, "post-link", null);
                    postLink.addEventListener("click", () => router.navigateTo(`/blog/${postId}`));

                    const titleEn = post.getTitle ? post.getTitle('en') : ((post.postTitle as any)?.en || "untitled");
                    const titleEs = post.getTitle ? post.getTitle('es') : ((post.postTitle as any)?.es || titleEn);
                    const initialTitle = currentLang === 'es' && titleEs ? titleEs : titleEn;

                    const postTitle = makeElement("h2", null, null, initialTitle);
                    postTitle.setAttribute("data-title-en", titleEn);
                    postTitle.setAttribute("data-title-es", titleEs || titleEn);
                    postLink.appendChild(postTitle);
                    postArticle.appendChild(postLink);

                    const postInfo = makeElement("h3", null, null, i18n.t('post_by_date', { author: post["author"], date: formatDate(post.publishDate, false) }));
                    postArticle.appendChild(postInfo);

                    const excerptEn = getExcerpt(post, 'en');
                    const excerptEs = getExcerpt(post, 'es');
                    const initialExcerpt = currentLang === 'es' && excerptEs ? excerptEs : (excerptEn || excerptEs);

                    const firstPElm = makeElement("p", null, null, initialExcerpt);
                    firstPElm.setAttribute("data-excerpt-en", excerptEn);
                    firstPElm.setAttribute("data-excerpt-es", excerptEs || excerptEn);
                    postArticle.append(firstPElm);

                    const readMore = createLink("Read More...", "", false);
                    readMore.setAttribute("data-i18n", "read_more");
                    readMore.classList.add("post-link");
                    readMore.addEventListener("click", () => router.navigateTo(`/blog/${postId}`));
                    postArticle.appendChild(readMore);
                    acc.appendChild(postArticle);
                    return acc;
                }, document.createElement("div"));

                container.appendChild(postsDiv);
                updateContent();
            }
        } catch (err) {
            console.error("Error loading posts:", err);
            container.innerHTML = "<p>Error loading posts.</p>";
        }
    }

    i18n.on('languageChanged', () => {
        updateLocalizedPostElements();
        updateContent();
    });

    auth.onAuthStateChanged(async (user) => {
        const adminActions = document.getElementById("admin-actions") as HTMLElement;

        if (adminActions) {
            adminActions.innerHTML = "";
        }

        if (user) {
            try {
                const role = await getUserRole(user.uid);
                if (role === "admin" && adminActions) {
                    adminActions.classList.remove("hide");
                    adminActions.style.display = "block";

                    const newPostButton = createButton({
                        buttonText: "Create New Post",
                        buttonType: "button",
                        buttonId: "new-post",
                        buttonClass: "accent-button",
                        icon: "add"
                    });
                    //newPostButton.addEventListener("click", () => navigateTo("/blog/editpost"));
                    adminActions.appendChild(newPostButton);
                }
            } catch (err) {
                console.error("Error verifying admin permissions:", err);
            }
        }

        try {
            posts = await getAllPosts();
            await loadPosts();
        } catch (err) {
            console.error("Failed to fetch posts:", err);
        } finally {
            if (loading) loading.remove();
            if (container) container.classList.remove("hide");
            updateContent();
        }
    });


}