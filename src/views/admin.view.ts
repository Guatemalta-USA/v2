import type { Post } from "../models/post.model.ts";
import { Project, type ProjectInfo } from "../models/project.model";
import { state } from "../modules/state.module";
import { confirmDeleteModal, copyToClipboard, createButton, createMessage, createTableHeader, makeElement, promptModal } from "../modules/utils";
import { router } from "../router";
import { deleteProjectFromDonateList, getAllPageSummaries, getDonateButtonList, getProjectsByStatus, getUnpublishedProjects, setProjectLink, updateDonateListOrder, updateProjectsOrder, type PageSummary } from "../services/firebase.service.ts";
import { createDonateQRCodeWithLogo, createQRCodeWithLogo } from "../services/givebutter.service.ts";
import htmlContent from "./admin.html?raw";
import Sortable from "sortablejs";

let donateButtonListLength: number = 0;

function renderPostsOrProjects(itemArray: Post[] | Project[], containerCard: HTMLElement) {
    containerCard.innerHTML = "";

    const table = makeElement("table", null, null, null);
    const headers = createTableHeader(["", "Name", "view", "Edit"], "center");

    const tbody = itemArray.reduce((acc: HTMLElement, item: Post | Project) => {
        const tableRow = document.createElement("tr");

        // Ensure targetId gets a valid ID string
        const targetId = item.id ? String(item.id) : item.getTitle("en");
        tableRow.setAttribute("data-id", targetId);

        // Drag handle cell
        const dragCell = document.createElement("td");
        const dragIcon = makeElement("span", null, "material-symbols-outlined drag-handle", "drag_indicator");
        dragCell.appendChild(dragIcon);

        const itemID = item.id ? String(item.id) : "";

        // Name cell
        const nameCell = makeElement("td", null, null, item.getTitle("en"));

        // View button cell
        const viewBtnCell = document.createElement("td");
        const viewBtn = document.createElement("button") as HTMLButtonElement;
        viewBtn.classList.add("table-button");
        viewBtn.type = "button";
        const viewIcon = makeElement("span", null, "material-symbols-outlined", "visibility");
        viewBtn.appendChild(viewIcon);
        viewBtn.addEventListener("click", () => {
            if (item instanceof Project) {
                router.navigateTo(`/impact/${itemID}`);
            } else {
                router.navigateTo(`/blog/${itemID}`);
            }
        });
        viewBtnCell.appendChild(viewBtn);

        // Edit button cell
        const editBtnCell = document.createElement("td");
        const editBtn = document.createElement("button") as HTMLButtonElement;
        editBtn.classList.add("table-button");
        editBtn.type = "button";
        const editIcon = makeElement("span", null, "material-symbols-outlined", "edit");
        editBtn.appendChild(editIcon);
        editBtn.addEventListener("click", () => {
            if (item instanceof Project) {
                router.navigateTo(`/impact/${itemID}/edit`);
            } else {
                router.navigateTo(`/blog/${itemID}/edit`);
            }
        });
        editBtnCell.appendChild(editBtn);

        tableRow.append(dragCell, nameCell, viewBtnCell, editBtnCell);
        acc.appendChild(tableRow);
        return acc;
    }, makeElement("tbody", null, null, null));

    table.append(headers, tbody);
    containerCard.appendChild(table);

    const isProjectList = itemArray.length > 0 && itemArray[0] instanceof Project;

    if (isProjectList) {
        Sortable.create(tbody, {
            animation: 150,
            handle: ".drag-handle",
            ghostClass: "sortable-ghost",
            onEnd: async () => {
                const updatedRows = Array.from(tbody.children) as HTMLElement[];
                const orderUpdates = updatedRows.map((row, index) => ({
                    id: row.getAttribute("data-id")!,
                    newOrderIndex: index + 1
                }));

                try {
                    await updateProjectsOrder(orderUpdates);
                    createMessage({
                        messageBody: "Projects order updated successfully",
                        location: "main-message",
                        type: "check_circle",
                        autoCloseSeconds: 3
                    });
                } catch (err) {
                    console.error(err);
                    createMessage({
                        messageBody: "Failed to save Projects order",
                        location: "main-message",
                        type: "error"
                    });
                }
            }
        });
    }
}

async function renderDonateListTable(tableContainer: HTMLElement) {
    tableContainer.innerHTML = "";

    const donateButtonLinks = await getDonateButtonList();
    donateButtonListLength = donateButtonLinks.length;
    const donateListTable = makeElement("table", "donate-list", null, null);

    // Header with extra column for Drag handle
    const donateListTableHeader = createTableHeader(["", "Project Name", "Share Link (click to copy to clipboard)", "Edit", "Delete"], "center");

    const donateListTableBody = donateButtonLinks.reduce((acc: HTMLElement, link: ProjectInfo) => {
        const tableRow = document.createElement("tr");
        const targetId = link.id || link.projectName;
        tableRow.setAttribute("data-id", targetId);

        // Drag Handle Cell
        const dragCell = document.createElement("td");
        const dragIcon = makeElement("span", null, "material-symbols-outlined drag-handle", "drag_indicator");
        dragCell.appendChild(dragIcon);

        const projectNameCell = makeElement("td", null, null, link["projectName"]);
        const shareLink = `https://guatemaltausa.org/donate?id=${link["formId"]}`;
        const shareLinkCell = makeElement("td", null, null, shareLink);
        shareLinkCell.addEventListener("click", async () => await copyToClipboard(shareLink));

        // Edit Button
        const editBtnCell = document.createElement("td");
        const editBtn = document.createElement("button") as HTMLButtonElement;
        editBtn.classList.add("table-button");
        editBtn.type = "button";
        const editIcon = makeElement("span", null, "material-symbols-outlined", "edit");
        editBtn.appendChild(editIcon);
        editBtn.addEventListener("click", async () => {
            const updateResponse = await promptModal(
                "Update the link for the Donate Button",
                ["Project Name", "Form ID"],
                "update",
                false,
                [link["projectName"], link["formId"]]
            );
            if (updateResponse) {
                const [updatedName, updatedFormId, updatedUrl] = updateResponse;
                if (updatedName.trim() !== "" && updatedFormId.trim() !== "" && updatedUrl.trim() !== "") {
                    const updatedProjectLink: ProjectInfo = {
                        ...(link.id && { id: link.id }),
                        projectName: updatedName,
                        projectId: updatedUrl,
                        formId: updatedFormId
                    };
                    await setProjectLink(updatedProjectLink);
                    createMessage({ messageBody: "Project updated successfully", location: "main-message", type: "check_circle", autoCloseSeconds: 5 });
                    await renderDonateListTable(tableContainer);
                }
            }
        });
        editBtnCell.appendChild(editBtn);

        // Delete Button
        const deleteBtnCell = document.createElement("td");
        const deleteBtn = document.createElement("button") as HTMLButtonElement;
        deleteBtn.classList.add("table-button");
        deleteBtn.type = "button";
        const deleteIcon = makeElement("span", null, "material-symbols-outlined", "delete");
        deleteBtn.appendChild(deleteIcon);
        deleteBtn.addEventListener("click", async () => {
            const confirmed = await confirmDeleteModal(
                `Remove ${link["projectName"]} from the Donate Button list?`,
                "Deleting this will NOT delete the project or make it unpublished"
            );
            if (confirmed) {
                try {
                    await deleteProjectFromDonateList(targetId);
                    createMessage({ messageBody: "Project deleted successfully", location: "main-message", type: "check_circle", autoCloseSeconds: 5 });
                    await renderDonateListTable(tableContainer);
                } catch (error: any) {
                    createMessage({ messageBody: error, location: "main-message", type: "error" });
                }
            }
        });
        deleteBtnCell.appendChild(deleteBtn);

        tableRow.append(dragCell, projectNameCell, shareLinkCell, editBtnCell, deleteBtnCell);
        acc.appendChild(tableRow);
        return acc;
    }, makeElement("tbody", "donate-list-tbody", null, null));

    donateListTable.append(donateListTableHeader, donateListTableBody);
    tableContainer.appendChild(donateListTable);

    Sortable.create(donateListTableBody, {
        animation: 150,
        handle: '.drag-handle',
        ghostClass: 'sortable-ghost',
        onEnd: async () => {
            const updatedRows = Array.from(donateListTableBody.children) as HTMLElement[];

            const orderUpdates = updatedRows.map((row, index) => ({
                id: row.getAttribute("data-id")!,
                newOrderIndex: index + 1
            }));

            try {
                await updateDonateListOrder(orderUpdates);
                createMessage({ messageBody: "Donate list order updated successfully", location: "main-message", type: "check_circle", autoCloseSeconds: 3 });
            } catch (error) {
                createMessage({ messageBody: "Failed to save donate list order", location: "main-message", type: "error" });
            }
        }
    });
}

export async function renderAdminPage(container: HTMLElement) {
    container.innerHTML = htmlContent;

    if (state.currentRole !== "admin") {
        createMessage({ messageBody: "Access denied. Admin privileges are required", location: "main-message", type: "error", i18n: "access_denied" });
        router.navigateTo("/");
        return;
    }

    const qrCodeBtnSection = document.getElementById("generate-buttons") as HTMLElement;
    const qrCanvas = document.getElementById("qr-canvas") as HTMLElement;
    const unpublishedSection = document.getElementById("unpublished") as HTMLElement;
    const currentSection = document.getElementById("current") as HTMLElement;
    const donateListSection = document.getElementById("donate-list") as HTMLElement;
    const pagesSection = document.getElementById("pages") as HTMLElement;

    async function renderQRCanvas(canvas: HTMLCanvasElement, fileName: string) {
        qrCodeBtnSection.classList.add("hide");
        qrCanvas.innerHTML = "";
        qrCanvas.append(canvas);

        const downloadBtn = createButton({ buttonText: "Download QR Code", buttonType: "button", buttonId: "download", buttonClass: "accent-button", icon: "download" });
        downloadBtn.onclick = function () {
            try {
                const dataUrl = canvas.toDataURL('image/png');
                const a = document.createElement('a');
                a.href = dataUrl;
                a.download = fileName;
                a.click();
            } catch (err) {
                createMessage({ messageBody: `Could not download image: ${err}`, location: "main-message", type: "error" });
            }
        };

        const newBtn = createButton({ buttonText: "Generate new QR Code", buttonType: "button", buttonId: "new", buttonClass: "accent-button", icon: "add" });
        newBtn.onclick = function () {
            qrCanvas.classList.add("hide");
            qrCodeBtnSection.classList.remove("hide");
        };

        const btnRow = makeElement("div", null, "button-row left", null);
        btnRow.append(downloadBtn, newBtn);
        qrCanvas.append(btnRow);
        qrCanvas.classList.remove("hide");
    }

    // Set up generate QR code buttons
    const generateH2 = makeElement("h2", null, null, "Generate QR Codes");
    const donateGenerateH3 = makeElement("h3", null, null, "Donate QR Code");
    const donateP = makeElement("p", null, null, "Generate a QR Code that links to the donate form for a project");
    const generateDonateBtn = createButton({ buttonText: "Generate Donate QR", buttonType: "button", buttonId: "donate-qr", buttonClass: "accent-button" });

    generateDonateBtn.addEventListener("click", async () => {
        const campaignID = await promptModal(
            "Enter the campaign Id\n(found in the embed code of the form widget)",
            ["Campaign ID"],
            "Generate",
            false
        );
        if (campaignID) {
            const cID = campaignID[0];
            if (cID.trim() !== "") {
                try {
                    const canvas = await createDonateQRCodeWithLogo(cID);
                    const imageFileName = `donate-${cID}.png`;
                    renderQRCanvas(canvas, imageFileName);
                } catch (error) {
                    console.error('Error generating QR code:', error);
                }
            }
        }
    });

    // Link QR Code Block
    const linkGenerateH3 = makeElement("h3", null, null, "Link QR Code");
    const linkP = makeElement("p", null, null, "Generate a QR code that goes to a link");
    const generateLinkBtn = createButton({ buttonText: "Generate Link QR", buttonType: "button", buttonId: "link-qr", buttonClass: "accent-button" });

    generateLinkBtn.addEventListener("click", async () => {
        const url = await promptModal(
            "Enter the url",
            ["url"],
            "Generate",
            false
        );
        if (url) {
            const urlString = url[0];
            if (urlString.trim() !== "") {
                try {
                    const canvas = await createQRCodeWithLogo(urlString);
                    const urlName = urlString.split(".")[1] || "qr";
                    const imageFileName = `${urlName}-gusa.png`;
                    renderQRCanvas(canvas, imageFileName);
                } catch (error) {
                    console.error('Error generating QR code:', error);
                }
            }
        }
    });
    qrCodeBtnSection.append(generateH2, donateGenerateH3, donateP, generateDonateBtn, linkGenerateH3, linkP, generateLinkBtn);

    // Render unpublished projects card
    const unpublishedProjects = await getUnpublishedProjects();
    if (unpublishedProjects.length === 0) {
    } else {
        renderPostsOrProjects(unpublishedProjects, unpublishedSection);
        const unpublishedH2 = makeElement("h2", null, null, "Unpublished Projects");
        unpublishedSection.prepend(unpublishedH2);
        unpublishedSection.classList.remove("hide");
    }

    // Render current projects card
    const currentProjects = await getProjectsByStatus(true);
    if (currentProjects.length === 0) {
    } else {
        renderPostsOrProjects(currentProjects, currentSection);
        const currentH2 = makeElement("h2", null, null, "Current Projects");
        currentSection.prepend(currentH2);
        currentSection.classList.remove("hide");
    }

    // Render donate list card
    const donateListH2 = makeElement("h2", null, null, "Donate Button List");
    const tableContainer = makeElement("div", "donate-list-table-container", null, null);

    const addProjectToDonate = createButton({ buttonText: "Add project to donate list", buttonType: "button", buttonId: "add-project", buttonClass: "accent-button", icon: "add" });
    addProjectToDonate.addEventListener("click", async () => {
        const projectInfo = await promptModal(
            "Enter the ID from the form widget\nEnter the url path of the project",
            ["Project name in list", "form ID", "project url path"],
            "add",
            false
        );
        if (projectInfo) {
            const [projectName, formID, projectURLPath] = projectInfo;
            if (projectName.trim() !== "" && formID.trim() !== "" && projectURLPath.trim() !== "") {
                const newProject: ProjectInfo = {
                    projectName: projectName,
                    projectId: projectURLPath,
                    formId: formID,
                    orderIndex: donateButtonListLength + 1
                };
                try {
                    await setProjectLink(newProject);
                    createMessage({ messageBody: "Project Added to Donate Button List", location: "main-message", type: "check_circle" });
                    await renderDonateListTable(tableContainer); // Refresh table
                } catch (error: any) {
                    createMessage({ messageBody: error, location: "main-message", type: "error" });
                }
            }
        }
    });

    donateListSection.append(donateListH2, tableContainer, addProjectToDonate);
    await renderDonateListTable(tableContainer);

    // Render pages card
    const pages = await getAllPageSummaries();

    const pagesCardHeading = makeElement("h2", null, null, "Pages");
    const table = makeElement("table", null, null, null);
    const headers = createTableHeader(["Name", "view", "Edit"], "center");
    const tbody = pages.reduce((acc: HTMLElement, page: PageSummary) => {
        const tableRow = document.createElement("tr");
        tableRow.setAttribute("data-id", page.id);
        // Name cell
        const nameCell = makeElement("td", null, null, page.pageName["en"]);
        // View button cell
        const viewBtnCell = document.createElement("td");
        const viewBtn = document.createElement("button") as HTMLButtonElement;
        viewBtn.classList.add("table-button");
        viewBtn.type = "button";
        const viewIcon = makeElement("span", null, "material-symbols-outlined", "visibility");
        viewBtn.appendChild(viewIcon);
        viewBtn.addEventListener("click", () => {
            router.navigateTo(`/${page.id}`);
        });
        viewBtnCell.appendChild(viewBtn);
        // Edit button cell
        const editBtnCell = document.createElement("td");
        const editBtn = document.createElement("button") as HTMLButtonElement;
        editBtn.classList.add("table-button");
        editBtn.type = "button";
        const editIcon = makeElement("span", null, "material-symbols-outlined", "edit");
        editBtn.appendChild(editIcon);
        editBtn.addEventListener("click", () => {
            router.navigateTo(`/${page.id}/edit`);
        });
        editBtnCell.appendChild(editBtn);

        tableRow.append(nameCell, viewBtnCell, editBtnCell);
        acc.appendChild(tableRow);
        return acc;

    }, makeElement("tbody", null, null, null))

    table.append(headers, tbody);
    const newPageBtn = createButton({
        buttonText: "Create New Page",
        buttonType: "button",
        buttonId: "new-page-btn",
        buttonClass: "accent-button",
        icon: "add"
    });
    newPageBtn.addEventListener("click", () => router.navigateTo("/new-page"));
    pagesSection.append(pagesCardHeading, table, newPageBtn);

}