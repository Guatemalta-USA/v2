import type { Project } from "../models/project.model";
import { updateContent } from "../modules/i18n";
import { state } from "../modules/state.module";
import { createButton, createLink, makeElement } from "../modules/utils";
import { router } from "../router.ts";
import { getProjectsByStatus } from "../services/firebase.service.ts";
import htmlContent from "./impact.html?raw";

export async function renderImpactPage(mainElement: HTMLElement) {
    mainElement.innerHTML = htmlContent;

    const container = document.getElementById("projects-container") as HTMLElement;
    const loading = document.getElementById("loading");
    const actionButtons = document.getElementById("action-buttons") as HTMLElement;
    const tabs = document.getElementById("tab-navigation") as HTMLElement;

    if (state.currentRole === "admin") {
        const newProjectButton = createButton({
            buttonText: "Start New Project",
            buttonType: "button",
            buttonId: "new-project",
            buttonClass: "accent-button",
            icon: "add",
            i18n: "start_new_project_btn"
        });
        newProjectButton.addEventListener("click", () => router.navigateTo("/impact/new"));
        actionButtons.appendChild(newProjectButton);
    }

    // Initial data fetch
    let currentProjects: Project[] = await getProjectsByStatus(true);
    let pastProjects: Project[] = await getProjectsByStatus(false);

    const activeTab = document.querySelector('.tab-btn.active')?.id === 'past-tab' ? 'past' : 'current';
    await loadProjects(activeTab);

    const currentTabBtn = createButton({
        buttonText: "Current Projects",
        buttonType: "button",
        buttonId: "current-tab",
        buttonClass: "tab-btn active",
        i18n: "current_projects"
    });

    const pastTabBtn = createButton({
        buttonText: "Past Projects",
        buttonType: "button",
        buttonId: "past-tab",
        buttonClass: "tab-btn",
        i18n: "past_projects"
    });

    function setActiveTab(selectedTab: HTMLElement) {
        currentTabBtn.classList.remove("active");
        pastTabBtn.classList.remove("active");
        selectedTab.classList.add("active");
    }

    currentTabBtn.addEventListener("click", async () => {
        setActiveTab(currentTabBtn);
        await loadProjects("current");
        updateContent();
    });

    pastTabBtn.addEventListener("click", async () => {
        setActiveTab(pastTabBtn);
        await loadProjects("past");
        updateContent();
    });

    tabs.append(currentTabBtn, pastTabBtn);

    function getExcerpt(project: Project, lang: 'en' | 'es'): string {
        if (typeof project.getFirstParagraph === "function") {
            const result = project.getFirstParagraph(lang);
            if (result) return result;
        }
        return "";
    }

    async function loadProjects(status: string) {
        container.innerHTML = "";

        // Select correct status array (already populated with Project class instances)
        const projectsToDisplay = status === "current" ? currentProjects : pastProjects;

        const currentLang = (document.documentElement.lang as 'en' | 'es') || 'en';

        try {
            if (projectsToDisplay.length === 0) {
                const noProjects = makeElement("p", null, null, "No projects yet. Check back soon!");
                container.appendChild(noProjects);
            } else {
                const projectsDiv = projectsToDisplay.reduce((acc: HTMLElement, project: Project) => {
                    const projectId = project.id ? project.id : "";
                    const projectArticle = makeElement("article", projectId, "project-card", null);

                    // Title Link & Heading
                    const projectLink = makeElement("a", null, "post-link", null);
                    projectLink.addEventListener("click", () => router.navigateTo(`/impact/${projectId}`));

                    const titleEn = project.getTitle ? project.getTitle('en') : ((project.projectTitle as any)?.en || "Untitled");
                    const titleEs = project.getTitle ? (project.getTitle('es') || titleEn) : ((project.projectTitle as any)?.es || titleEn);
                    const initialTitle = project.getTitle ? project.getTitle(currentLang) : (currentLang === 'es' ? titleEs : titleEn);

                    const projectTitle = makeElement("h2", null, "project-title-heading", initialTitle);

                    // Attach attributes for updateContent() i18n switcher
                    projectTitle.setAttribute("data-title-en", titleEn);
                    projectTitle.setAttribute("data-title-es", titleEs);

                    projectLink.appendChild(projectTitle);
                    projectArticle.appendChild(projectLink);

                    // Paragraph Excerpt
                    const excerptEn = getExcerpt(project, 'en');
                    const excerptEs = getExcerpt(project, 'es') || excerptEn;
                    const initialExcerpt = currentLang === 'es' ? excerptEs : excerptEn;

                    const firstPElm = makeElement("p", null, null, initialExcerpt);

                    // Attach attributes for updateContent() i18n switcher
                    firstPElm.setAttribute("data-excerpt-en", excerptEn);
                    firstPElm.setAttribute("data-excerpt-es", excerptEs);

                    projectArticle.appendChild(firstPElm);

                    // Read More Link
                    const readMore = createLink("Read More...", "", false);
                    readMore.setAttribute("data-i18n", "read_more");
                    readMore.classList.add("post-link");
                    readMore.addEventListener("click", () => router.navigateTo(`/impact/${projectId}`));
                    projectArticle.appendChild(readMore);

                    acc.appendChild(projectArticle);
                    return acc;
                }, document.createElement("div"));

                container.appendChild(projectsDiv);
                updateContent();
            }
        } catch (err) {
            console.error("Error displaying projects:", err);
            container.innerHTML = "<p>Error loading projects.</p>";
        }
    }

    await loadProjects("current");
    tabs.classList.remove("hide");
    updateContent();
    if (loading) loading.remove();
    container.classList.remove("hide");
}