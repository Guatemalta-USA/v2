import type { Profile } from "../models/profile.model";
import i18n, { getResolvedLanguage, updateContent } from "../modules/i18n";
import { deleteImage, resizeImage, uploadImage } from "../modules/imageService";
import { confirmDeleteModal, createButton, createMessage, makeElement } from "../modules/utils";
import { getAllProfiles, addProfile, getProfilesByCountry, deleteProfile, updateProfile } from "../services/firebase.service.ts";
import htmlContent from "./about.html?raw"
import { state } from "../modules/state.module.ts";

export async function renderAboutPage(container: HTMLElement) {
    container.innerHTML = htmlContent;

    const loading = document.getElementById("loading");
    const viewSection = document.getElementById("content-display") as HTMLElement;
    const profilesSection = document.getElementById("profiles-section") as HTMLElement;
    const modalRoot = document.getElementById("modal-root") as HTMLElement;
    const adminControls = document.getElementById("admin-controls") as HTMLElement;
    const addProfileForm = document.getElementById("add-profile-form") as HTMLFormElement;
    const cancelButton = document.getElementById("close-modal");
    let editingProfileId: string | null = null;
    let isAdmin = false;
    const countries: string[] = ["usa", "guatemala"];
    const contactForm = document.getElementById("contact-form") as HTMLFormElement;
    const currentLang = (getResolvedLanguage() || 'en').slice(0, 2) as 'en' | 'es';

    // TODO: Get Our story section working

    async function handleSubmit() {
        const addProfileForm = document.getElementById("add-profile-form") as HTMLFormElement;
        const submitBtn = document.getElementById("save-profile") as HTMLButtonElement;
        const fileInput = document.getElementById("p-image") as HTMLInputElement;
        const file = fileInput.files?.[0];

        try {
            submitBtn.disabled = true;
            submitBtn.innerText = "Processing...";

            const allProfiles = await getAllProfiles();
            const existingProfile = allProfiles.find((p) => p.name === editingProfileId);

            let photoURL = "";

            if (file) {
                if (editingProfileId && existingProfile?.photoURL) {
                    await deleteImage(existingProfile.photoURL);
                }

                const resizedBlob = await resizeImage(file, {});
                photoURL = await uploadImage(resizedBlob as File);
            } else if (editingProfileId && existingProfile) {
                photoURL = existingProfile.photoURL;
            }

            const selectElement = document.getElementById("country") as HTMLSelectElement;
            const profileFormData = new FormData(addProfileForm);
            const name = profileFormData.get("p-name");
            const positionEn = profileFormData.get("p-position-english");
            const positionEs = profileFormData.get("p-position-spanish");
            const email = profileFormData.get("p-email");
            const country = profileFormData.get("country");
            const bioEn = profileFormData.get("p-about-english");
            const bioEs = profileFormData.get("p-about-spanish");
            if (name && positionEn && positionEs && country && bioEn && bioEs) {
                const profileData: Profile = {
                    name: name.toString().trim(),
                    position: {
                        en: positionEn.toString().trim(),
                        es: positionEs.toString().trim()
                    },
                    email: email ? email.toString().trim() : "",
                    about: {
                        en: bioEn.toString().trim(),
                        es: bioEs.toString().trim()
                    },
                    country: selectElement.value,
                    photoURL: photoURL,
                };

                if (editingProfileId) {
                    await updateProfile(editingProfileId, profileData);
                    createMessage({ messageBody: "Profile updated!", location: "main-message", type: "edit" });
                } else {
                    if (!file) {
                        createMessage({ messageBody: "Please select an image for a new profile", location: "modal-message", type: "error" });
                        submitBtn.disabled = false;
                        submitBtn.innerText = "Save Profile";
                        return;
                    }
                    await addProfile(profileData);
                    createMessage({ messageBody: "Profile added!", location: "main-message", type: "check_circle" });
                }

                modalRoot.classList.add("hide");
                modalRoot.style.display = "none";
                addProfileForm.reset();
                editingProfileId = null;

                await loadProfiles();
            } else if (!name) {
                createMessage({ messageBody: "Please enter the name", location: "modal-message", type: "error" });
                return;
            } else if (!positionEn) {
                createMessage({ messageBody: "Please enter the English position", location: "modal-message", type: "error" });
                return;
            } else if (!positionEs) {
                createMessage({ messageBody: "Please enter the Spanish position", location: "modal-message", type: "error" });
                return;
            } else if (!country) {
                createMessage({ messageBody: "Please select a country", location: "modal-message", type: "error" });
                return;
            } else if (!bioEn) {
                createMessage({ messageBody: "Please enter the English bio", location: "modal-message", type: "error" });
                return;
            } else if (!bioEs) {
                createMessage({ messageBody: "Please enter the Spanish bio", location: "modal-message", type: "error" });
                return;
            }
        } catch (error) {
            console.error("Error in handleSubmit:", error);
            createMessage({ messageBody: "An error occurred while saving the profile.", location: "modal-message", type: "error" });
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerText = "Save Profile";
        }
    }

    async function loadProfiles() {
        profilesSection.innerHTML = "";

        for (const country of countries) {
            const profilesForCountry: Profile[] = await getProfilesByCountry(country);

            if (profilesForCountry.length !== 0) {
                profilesSection.classList.add("blue-background");

                const profilesContainer = makeElement("div", null, "container", null);

                const titleText = country.charAt(0).toUpperCase() + country.slice(1);
                const countryH2 = makeElement(
                    "h2",
                    "",
                    "white-text",
                    i18n.t('our_team_title', { country: titleText })
                );
                profilesContainer.appendChild(countryH2);

                const profilesDiv = profilesForCountry.reduce(
                    (acc: HTMLElement, currentProfile: Profile, index) => {
                        const profileArticle = makeElement("article", null, "profile-card", null);
                        if (index % 2 !== 0) profileArticle.classList.add("flex-reverse");

                        const imgContainer = makeElement("div", null, "image-container", null);
                        const profilePicture = document.createElement("img");
                        profilePicture.src = currentProfile.photoURL;
                        imgContainer.appendChild(profilePicture);
                        profileArticle.appendChild(imgContainer);

                        const detailsContainer = makeElement("div", null, "profile-info", null);
                        const profileName = makeElement("h3", null, null, currentProfile.name);
                        detailsContainer.appendChild(profileName);

                        const positionEl = makeElement("p", null, "profile-position", null);
                        const positionBold = document.createElement("b");
                        positionBold.textContent = currentProfile.position[currentLang];
                        positionEl.appendChild(positionBold);
                        detailsContainer.appendChild(positionEl);

                        const aboutElEN = makeElement("div", null, "profile-bio", null);
                        const aboutElEs = makeElement("div", null, "profile-bio", null);
                        const paragraphsEN = currentProfile.about['en']
                            .split(/\r?\n/)
                            .map((p) => p.trim())
                            .filter((p) => p.length > 0);

                        paragraphsEN.forEach((paragraphText) => {
                            const formattedText = paragraphText.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>");

                            const p = document.createElement("p");
                            p.innerHTML = formattedText;
                            aboutElEN.appendChild(p);
                        });
                        const paragraphsEs = currentProfile.about['es']
                            .split(/\r?\n/)
                            .map((p) => p.trim())
                            .filter((p) => p.length > 0);

                        paragraphsEs.forEach((paragraphText) => {
                            const formattedText = paragraphText.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>");

                            const p = document.createElement("p");
                            p.innerHTML = formattedText;
                            aboutElEs.appendChild(p);
                        });
                        const bioContentEn = aboutElEN || aboutElEs;
                        const bioContentEs = aboutElEs || aboutElEN;
                        const initialContent = currentLang === "en" ? bioContentEn : bioContentEs;

                        detailsContainer.appendChild(initialContent);

                        if (isAdmin) {
                            const actionsDiv = makeElement("div", null, "profile-actions", null);
                            const editBtn = createButton({ buttonText: "Edit", buttonType: "button", buttonId: `edit-${index}`, buttonClass: "edit-btn", icon: "edit", i18n: "button_edit" });
                            editBtn.onclick = () => handleEdit(currentProfile);

                            const deleteBtn = createButton({ buttonText: "Delete", buttonType: "button", buttonId: "delete-button", buttonClass: "delete-button", icon: "delete", i18n: "button_delete" });
                            deleteBtn.onclick = async () => {
                                const confirmed = await confirmDeleteModal(
                                    `Delete ${currentProfile.name}'s profile?`,
                                    "Deleting this profile will also delete their photo. This action cannot be undone."
                                );
                                if (confirmed) {
                                    try {
                                        if (currentProfile.photoURL) {
                                            await deleteImage(currentProfile.photoURL);
                                        }
                                        await deleteProfile(currentProfile.name);
                                        await loadProfiles();
                                        createMessage({ messageBody: "Profile and image deleted successfully.", location: "main-message", type: "delete" });
                                    } catch (err) {
                                        console.error("Delete failed:", err);
                                        createMessage(
                                            {
                                                messageBody: "Failed to fully delete the profile. Please try reloading the page",
                                                location: "main-message",
                                                type: "error"
                                            }
                                        );
                                    }
                                }
                            };

                            actionsDiv.appendChild(editBtn);
                            actionsDiv.appendChild(deleteBtn);
                            detailsContainer.appendChild(actionsDiv);
                        }

                        profileArticle.appendChild(detailsContainer);
                        acc.appendChild(profileArticle);
                        return acc;
                    },
                    document.createElement("div")
                );

                profilesDiv.setAttribute("id", "team-grid");
                profilesContainer.appendChild(profilesDiv);
                profilesSection.appendChild(profilesContainer);
            }
        }
        updateContent();
    }

    function handleEdit(profile: Profile) {
        editingProfileId = profile.name || null;
        const nameInput = document.getElementById("p-name") as HTMLInputElement;
        nameInput.value = profile.name;
        (document.getElementById("p-position-english") as HTMLInputElement).value = profile.position['en'];
        (document.getElementById("p-position-spanish") as HTMLInputElement).value = profile.position['es'];
        (document.getElementById("p-email") as HTMLInputElement).value = profile.email;
        (document.getElementById("p-about-english") as HTMLTextAreaElement).value = profile.about['en'];
        (document.getElementById("p-about-spanish") as HTMLTextAreaElement).value = profile.about['es'];
        (document.getElementById("country") as HTMLSelectElement).value = profile.country;

        nameInput.readOnly = true;
        nameInput.style.backgroundColor = "var(--table-even-row)";
        nameInput.style.cursor = "not-allowed";

        const submitBtn = document.getElementById("save-profile") as HTMLButtonElement;
        const modalTitle = modalRoot.querySelector("h2");

        if (modalTitle) modalTitle.innerText = `Editing: ${profile.name}`;
        submitBtn.innerText = "Update Profile";

        modalRoot.classList.remove("hide");
        modalRoot.style.display = "flex";
    }

    function sendContactEmails(form: HTMLFormElement) {
        const formData = new FormData(form);
        const nameInput = formData.get("entry.1134764317");
        if (!nameInput || nameInput.toString().trim() === "") {
            createMessage({ messageBody: "Please enter your name", location: "modal-message", type: "error", i18n: "please_enter_your_name" });
            return;
        }
        const emailInput = formData.get("entry.1281748752");
        if (!emailInput || emailInput.toString().trim() === "") {
            createMessage({ messageBody: "Please enter your email", location: "modal-message", type: "error", i18n: "please_enter_your_email" });
            return;
        }
        if (!emailInput.toString().includes("@")) {
            createMessage({ messageBody: "Please enter a valid email", location: "modal-message", type: "error", i18n: "please_enter_a_valid_email" });
            return;
        }
        const commentsTextArea = formData.get("entry.1027877017");
        if (!commentsTextArea || commentsTextArea.toString().trim() === "") {
            createMessage({ messageBody: "Please do not leave the comments field empty", location: "modal-message", type: "error", i18n: "please_dont_leave_comments_empty" });
            return;
        }

        const formAction =
            "https://docs.google.com/forms/d/e/1FAIpQLSeqUlWUU4Zi7sMO5aYOInfRlX52iAIehrEGlFTzuqIHsa1BiA/formResponse";

        fetch(formAction, {
            method: "POST",
            body: formData,
            mode: "no-cors",
        })
            .then((response) => {
                console.log(response);
                createMessage(
                    {
                        messageBody: "Your comments have been sent to our team",
                        location: "main-message",
                        type: "check_circle",
                        i18n: "comments_have_been_sent"
                    }
                );
                form.reset();
            })
            .catch((error) => {
                console.error("Network Error:", error);
                createMessage(
                    {
                        messageBody: "Error submitting comments. Please reload the page and try again",
                        location: "main-message",
                        type: "error",
                        i18n: "error_sending_comments"
                    }
                );
            });
    }

    if (state.currentRole === "admin") {
        const addBtn = createButton({ buttonText: "Add new member", buttonType: "button", buttonId: "addNew", buttonClass: "accent-button", icon: "add", i18n: "add_new_member" });
        addBtn.onclick = () => {
            modalRoot.classList.remove("hide");
            modalRoot.style.display = "flex";
        };
        adminControls.appendChild(addBtn);
    }

    await loadProfiles();

    addProfileForm.addEventListener("submit", (e) => {
        e.preventDefault();
        handleSubmit();
    });

    if (loading) loading.remove();
    viewSection.classList.remove("hide");

    if (window.location.hash) {
        const targetEl = document.querySelector(window.location.hash);
        if (targetEl) {
            setTimeout(() => {
                targetEl.scrollIntoView({ behavior: "smooth" });
            }, 50);
        }
    }

    cancelButton?.addEventListener("click", () => {
        modalRoot.classList.add("hide");
        modalRoot.style.display = "none";
        addProfileForm.reset();
    });

    contactForm.addEventListener("submit", (e) => {
        e.preventDefault();
        sendContactEmails(contactForm);
    });

    contactForm.classList.remove("hide");
    updateContent();
}