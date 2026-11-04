import type { ProjectInfo } from "../models/project.model.ts";
import { makeElement, createButton, createGiveButterWidget } from "../modules/utils.ts";
import { router } from "../router.ts";
import { getDonateButtonList } from "../services/firebase.service.ts.ts";
import htmlContent from "./donate.html?raw"

export async function renderDonatePage(container: HTMLElement, formId?: string) {
    container.innerHTML = htmlContent;

    const blueContainer = document.getElementById("blue-container") as HTMLElement;
    const projectsListSection = document.getElementById("projects-list") as HTMLElement;
    const donateWidgetWrapper = document.getElementById("donate-wrapper") as HTMLElement;
    const donateButtonLinks = await getDonateButtonList();
    const cardsList = await loadProjectsList()

    async function loadProjectsList() {
        return donateButtonLinks.reduce((acc: HTMLElement, link: ProjectInfo) => {
            const projectId = link["id"] ? link["id"] : "";
            const card = makeElement("div", projectId, "card", null);
            const cardTitle = makeElement("h3", null, null, link["projectName"]);
            const buttonRow = makeElement("div", null, "button-row center", null);
            if (link["formId"] !== "goeb69") {
                const viewBtn = createButton(
                    {
                        buttonText: "View Project",
                        buttonType: "button",
                        buttonId: `view-${projectId}`,
                        buttonClass: "accent-button",
                        icon: "visibility"
                    });
                viewBtn.addEventListener("click", () => router.navigateTo(`/impact/${projectId}`) );
                buttonRow.appendChild(viewBtn);
            }

            const donateBtn = createButton(
                {
                    buttonText: "Donate to Project",
                    buttonType: "button",
                    buttonId: `donate-${projectId}`,
                    buttonClass: "green-button",
                    icon: "favorite"
                }
            );
            donateBtn.addEventListener("click", () => loadDonateForm(link.formId, link.projectName));
            buttonRow.appendChild(donateBtn);
            card.append(cardTitle, buttonRow);
            acc.appendChild(card);
            return acc;
        }, makeElement("section", "projects-list", "hide", null));
    }

    function loadDonateForm(formId: string, projectName: string) {
        cardsList.classList.add("hide");
        donateWidgetWrapper.classList.remove("hide");
        donateWidgetWrapper.innerHTML = "";
        const projectTitleH2 = makeElement("h2", null, "white-text", projectName);
        projectTitleH2.style.textAlign = "center";
        const widget = createGiveButterWidget(formId, "form");
        const donateToDifferent = createButton(
            {
                buttonText: "Donate to a different project",
                buttonType: "button",
                buttonId: "donate-to-different",
                buttonClass: "green-button"
            }
        );
        donateToDifferent.addEventListener("click", () => {
            donateWidgetWrapper.classList.add("hide");
            cardsList.classList.remove("hide");
            console.log(`diff btn presses, closing ${formId} | ${JSON.stringify(cardsList.classList)} | ${JSON.stringify(donateWidgetWrapper.classList)}`)
        });
        donateWidgetWrapper.append(projectTitleH2, widget, donateToDifferent);
    }

    await loadProjectsList();
    blueContainer.replaceChild(cardsList, projectsListSection);

    if (formId) {
        const campaign = donateButtonLinks.find(project => project["formId"] === formId);
        if (campaign) loadDonateForm(campaign.formId, campaign.projectName);
    } else {
        cardsList.classList.remove("hide");
    }
}