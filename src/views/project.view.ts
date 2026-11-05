import { state } from "../modules/state.module";
import { router } from "../router";
import i18n, { getResolvedLanguage, updateContent } from "../modules/i18n";
import { createButton, createGiveButterWidget, createGoalBar, createMessage, formatDate, makeElement } from "../modules/utils";
import Quill from "quill";
import 'quill/dist/quill.snow.css';
import htmlContent from "./project.html?raw";
import { getCampaignTotalById, getPostsWithLinkedProjectId, getProjectById } from "../services/firebase.service.ts";

// Track language change listener for clean unsubscription
let projectLangListener: ((lng: string) => void) | null = null;

export async function renderProjectPage(container: HTMLElement, projectId: string) {
    container.innerHTML = htmlContent;

    const loadingEl = document.getElementById("loading");
    const projectContainer = document.getElementById("project-container");
    const goalBarContainer = document.getElementById("goal-bar-container");
    const displayTitleEl = document.getElementById("display-title");
    const viewerContainer = document.getElementById("viewer-container");
    const linkedPostsSection = document.getElementById("linked-posts");
    const lastUpdatedEl = document.getElementById("lastUpdated");
    const adminActionsEl = document.getElementById("admin-actions");

    try {
        const project = await getProjectById(projectId);
        if (!project) {
            createMessage({ messageBody: "Project not found.", location: "main-message", type: "error" });
            router.navigateTo("/impact");
            return;
        }

        const linkedPosts = await getPostsWithLinkedProjectId(projectId);

        const renderProjectContent = async () => {
            const lang = (getResolvedLanguage() || 'en').slice(0, 2) === 'es' ? 'es' : 'en';

            // 1. Set Title & Page Context
            const titleText = (typeof project.projectTitle === 'object'
                ? (project.projectTitle[lang] || project.projectTitle['en'])
                : project.projectTitle) || "Project Details";

            if (displayTitleEl) {
                displayTitleEl.textContent = titleText;
            }
            state.setPageContext({ parent: "impact", page: titleText });

            // 2. Clear and Render Goal Bar safely without duplication
            if (goalBarContainer) {
                goalBarContainer.innerHTML = '';
                if (project.goalBar) {
                    const goalBar = createGiveButterWidget(project.goalBar, "goal bar");
                    goalBarContainer.appendChild(goalBar);
                } else {
                    if (projectId === "a-gift-of-sight-restoring-vision-and-hope-in-guatemala") {
                        const totalRaised = await getCampaignTotalById(projectId);
                        const surgeries = Math.floor(totalRaised / 85);
                        const targetGoal = 30;
                        const customGoalBarContainer = makeElement("div", "custom-goal-bar-container", null, null);
                        const customGoalBarInfo = makeElement("div", null, "goal-info", null);
                        const surgeriesSponsored = makeElement("h2", null, null, `Surgeries sponsored: ${surgeries} / ${targetGoal}`);
                        const totalRaisedP = makeElement("p", null, null, `Total raised: $${totalRaised.toLocaleString('en-US')}`);
                        customGoalBarInfo.append(surgeriesSponsored, totalRaisedP);
                        const customGoalBar = createGoalBar(surgeries, targetGoal);
                        customGoalBarContainer.append(customGoalBarInfo, customGoalBar);
                        goalBarContainer.appendChild(customGoalBarContainer);
                    } else {
                        const totalRaised = await getCampaignTotalById(projectId);
                        const customGoalBarContainer = makeElement("div", "custom-goal-bar-container", null, null);
                        const customGoalBarInfo = makeElement("div", null, "goal-info", null);
                        const totalRaisedH2 = makeElement("h2", null, null, `Total Raised: $${totalRaised.toLocaleString('en-US')}`);
                        customGoalBarInfo.appendChild(totalRaisedH2);
                        customGoalBarContainer.appendChild(customGoalBarInfo);
                        goalBarContainer.appendChild(customGoalBarContainer);
                    }
                }
            }

            // 3. Render Read-Only Quill Content
            if (viewerContainer) {
                viewerContainer.innerHTML = '';
                const quillContainer = document.createElement('div');
                viewerContainer.appendChild(quillContainer);

                const rawContent = (typeof project.content === 'object' && project.content !== null)
                    ? (project.content[lang] || project.content['en'] || [])
                    : project.content;

                const ops = Array.isArray(rawContent) ? rawContent : [{ insert: rawContent || '' }];

                const readOnlyQuill = new Quill(quillContainer, {
                    theme: 'snow',
                    readOnly: true,
                    modules: { toolbar: false }
                });
                readOnlyQuill.setContents(ops);
            }

            // 4. Render Linked Project Updates / Posts
            if (linkedPostsSection) {
                const existingList = linkedPostsSection.querySelectorAll(".project-update-item");
                existingList.forEach(el => el.remove());

                if (linkedPosts && linkedPosts.length > 0) {
                    linkedPostsSection.classList.remove("hide");

                    linkedPosts.forEach(post => {
                        const postTitle = post.postTitle[lang] || post.postTitle['en'] || "Update";
                        const itemDiv = makeElement("div", null, "project-update-item", null);
                        itemDiv.style.cssText = "margin: 1rem 0; cursor: pointer;";

                        itemDiv.innerHTML = `
                            <h3>${postTitle}</h3>
                            <p>${post.author ? `By ${post.author}` : ''}</p>
                        `;
                        itemDiv.onclick = () => router.navigateTo(`/blog/${post.id}`);
                        linkedPostsSection.appendChild(itemDiv);
                    });
                } else {
                    linkedPostsSection.classList.add("hide");
                }
            }

            // 5. Render Last Updated Timestamp
            if (lastUpdatedEl && project.updatedAt) {
                lastUpdatedEl.innerHTML = '';
                const rawDate = project.updatedAt;
                const date = ('toDate' in rawDate && typeof (rawDate as any).toDate === 'function')
                    ? (rawDate as any).toDate()
                    : new Date(rawDate as unknown as string);

                const lastUpdatedP = makeElement("p", null, null, i18n.t('last_updated', { timestamp: formatDate(date, true) }));
                lastUpdatedEl.appendChild(lastUpdatedP);
            }

            // 6. Render Admin Actions (Edit Button)
            if (adminActionsEl) {
                adminActionsEl.innerHTML = '';
                if (state.currentRole === 'admin') {
                    adminActionsEl.classList.remove('hide');
                    const editBtn = createButton({
                        buttonText: "Edit Project",
                        buttonId: "edit-project",
                        buttonType: "button",
                        buttonClass: "accent-button",
                        icon: "edit",
                        i18n: "button_edit"
                    });
                    editBtn.onclick = () => {
                        router.navigateTo(`/impact/${projectId}/edit`);
                    };
                    adminActionsEl.appendChild(editBtn);
                } else {
                    adminActionsEl.classList.add('hide');
                }
            }
        };

        // Initial render pass
        renderProjectContent();

        // Subscribe to language changes for instant translation updates
        if (projectLangListener) {
            i18n.off("languageChanged", projectLangListener);
        }
        projectLangListener = () => {
            renderProjectContent();
        };
        i18n.on("languageChanged", projectLangListener);

    } catch (error) {
        console.error("Error loading project page:", error);
        createMessage({ messageBody: "Failed to load project details.", location: "main-message", type: "error" });
    } finally {
        if (loadingEl) loadingEl.remove();
        if (projectContainer) projectContainer.classList.remove("hide");
        updateContent();
    }
}