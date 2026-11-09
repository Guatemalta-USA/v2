import type { ChildSponsorship } from "../models/sponsorship.model";
import { updateContent } from "../modules/i18n";
import { resizeImage, uploadImage, deleteImage } from "../modules/imageService";
import { state } from "../modules/state.module.ts";
import { calcAge, confirmDeleteModal, createButton, createInputRow, createMessage, makeElement } from "../modules/utils";
import { addChildSponsorship, deleteChildSponsorship, getAllChildSponsorshipsByCohort, getAllCohorts } from "../services/firebase.service.ts";
import htmlContent from "./sponsorChild.html?raw";

export async function renderSponsorChildView(main: HTMLElement) {
    main.innerHTML = htmlContent;
    const adminActions = document.getElementById("admin-actions") as HTMLElement;
    const sponsorshipSection = document.getElementById("sponsorships") as HTMLElement;

    if (state.currentRole === "admin") {
        const newSponsorshipBtn = createButton({ buttonText: "Add Child to sponsor", buttonType: "button", buttonId: "new-child-btn", buttonClass: "accent-button", icon: "add" });
        newSponsorshipBtn.addEventListener("click", () => openSponsorshipModal());
        adminActions.append(newSponsorshipBtn);
        adminActions.classList.remove("hide");
    }

    async function submitData(formData: FormData): Promise<boolean> {
    return new Promise(async (resolve) => {
        let newChild: ChildSponsorship = {
            name: "",
            cohort: "",
            dateOfBirth: new Date(),
            village: "",
            bio: "",
            photoURL: "",
            sponsor: null
        }

        const name = formData.get("child-name");
        if (!name || name.toString().trim() === "") {
            createMessage({messageBody: "Please enter the name of the child", location: "main-message", type: "error"});
            resolve(false);
        } else {
            newChild["name"] = name.toString().trim();
        }

        const cohort = formData.get("cohort");
        if (!cohort || cohort.toString().trim() === "") {
            createMessage({messageBody: "Please enter the cohort", location: "main-message", type: "error"});
            resolve(false);
        } else {
            newChild["cohort"] = cohort.toString().trim();
        }

        const dob = formData.get("dob");
        if (!dob) {
            createMessage({messageBody: "Please enter the date of birth for the child", location: "main-message", type: "error"});
            resolve(false);
        } else {
            newChild["dateOfBirth"] = new Date(dob.toString());
        }

        const village = formData.get("village");
        if (!village || village.toString().trim() === "") {
            createMessage({messageBody: "Please enter the child's village", location: "main-message", type: "error"});
            resolve(false);
        } else {
            newChild["village"] = village.toString().trim();
        }

        const bio = formData.get("bio");
        if (bio && bio.toString().trim() !== "") {
            newChild["bio"] = bio.toString().trim();
        }

        const photoInput = document.getElementById("photoFile") as HTMLInputElement;
        const file = photoInput.files?.[0];
        if (file) {
            const resizedBlob = await resizeImage(file, {});
            newChild["photoURL"] = await uploadImage(resizedBlob as File);
        }

        try {
            await addChildSponsorship(newChild);
            resolve(true);
        } catch (error: any) {
            createMessage({messageBody: error, location: "main-message", type: "error"});
            resolve(false);
        }
    });
}

    async function updateSponsorshipSection() {
        sponsorshipSection.innerHTML = "";
        const cohorts = await getAllCohorts();

        for (const cohort of cohorts) {
            const childrenForCohort = await getAllChildSponsorshipsByCohort(cohort);

            const yearHeading = makeElement("h2", null, null, `${cohort} children`);
            yearHeading.style.textAlign = "center";
            const yearBlock = makeElement("div", `${cohort}-children`, "sponsor-container", null);

            for (const child of childrenForCohort) {
                const nextChild = makeElement("article", child["name"], "sponsor-card", null);
                const header = makeElement("div", null, "sponsorship-header", null);

                const photo = document.createElement("img") as HTMLImageElement;
                photo.src = child["photoURL"];
                photo.alt = child["name"];

                const childInfo = makeElement("div", null, "child-info", null);
                const nameH3 = makeElement("h3", null, null, `${child["name"]} (${calcAge(child.dateOfBirth).toString()})`);
                const villageH3 = makeElement("h3", null, null, `Village: ${child.village}`);
                childInfo.append(nameH3, villageH3);

                header.append(photo, childInfo);
                const bioP = makeElement("p", null, null, child["bio"]);
                nextChild.append(header, bioP);
                if (state.currentRole === "admin") {
                    const deleteBtn = createButton({ buttonText: "Delete", buttonType: "button", buttonId: `delete-${child["name"]}`, buttonClass: "delete-button", icon: "delete", i18n: "button_delete" });
                    deleteBtn.onclick = async () => {
                        const response = await confirmDeleteModal("Confirm Deletion", `Are you sure you want to remove ${child["name"]}?`)
                        if (response) {
                            if (child["photoURL"]) {
                                await deleteImage(child["photoURL"]);
                            }
                            await deleteChildSponsorship(child["name"]);
                            await updateSponsorshipSection();
                        }
                    };
                    nextChild.appendChild(deleteBtn);
                }

                yearBlock.appendChild(nextChild);
            }

            sponsorshipSection.append(yearHeading, yearBlock);
        }
        updateContent();
    }

    async function openSponsorshipModal() {
        const modalRoot = makeElement("div", "modal-root", null, null);
        const modalOverlay = makeElement("div", null, "modal-overlay", null);
        const modalContent = makeElement("form", null, "modal-content", null) as HTMLFormElement;

        const modalH2 = makeElement("h2", null, null, "Add new child to sponsor");
        modalContent.appendChild(modalH2);

        const nameRow = createInputRow(null, "text", "Name", "child-name") as HTMLInputElement;
        const cohortRow = createInputRow(null, "string", "Cohort", "cohort");
        const dobRow = createInputRow(null, "date", "Date of Birth", "dob");
        const villageRow = createInputRow(null, "string", "Village", "village");
        const bio = makeElement("textarea", "bio", null, null) as HTMLTextAreaElement;
        bio.placeholder = "Bio...";
        bio.name = "bio";
        bio.id = "bio";
        const photoUpload = createInputRow("Photo:", "file", "Photo", "photoFile") as HTMLInputElement;
        photoUpload.accept = "image/*";
        modalContent.append(nameRow, cohortRow, dobRow, villageRow, bio, photoUpload);

        const buttonRow = makeElement("div", null, "button-row", null);

        const closeModal = () => {
            window.removeEventListener("keydown", handleKeyDown);
            document.body.removeChild(modalRoot);
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                closeModal();
            }
        };

        const submitBtn = createButton({ buttonText: "Add Child", buttonType: "button", buttonId: "submit-btn", buttonClass: "accent-button", icon: "add" }) as HTMLButtonElement;
        submitBtn.onclick = async function () {
            submitBtn.disabled = true;
            submitBtn.innerText = "Processing...";

            let success = await submitData(new FormData(modalContent));
            if (success) {
                closeModal();
                modalContent.reset();
                await updateSponsorshipSection();
            }
        }

        const cancelButton = createButton({ buttonText: "Cancel", buttonType: "button", buttonId: "cancel-btn", buttonClass: "accent-button", icon: "close", i18n: "button_cancel" }) as HTMLButtonElement;
        cancelButton.onclick = function () {
            modalContent.reset();
            closeModal();
        };

        window.addEventListener("keydown", handleKeyDown);
        buttonRow.append(cancelButton, submitBtn);

        modalContent.appendChild(buttonRow);
        modalOverlay.appendChild(modalContent);
        modalRoot.appendChild(modalOverlay);

        modalRoot.style.display = 'flex';
        document.body.appendChild(modalRoot);
    }

    const loading = document.getElementById("loading");
    if (loading) loading.classList.add("hide");
    updateContent();
    updateSponsorshipSection();

}