import { createMessage, storeMessage } from "../modules/utils";
import { router } from "../router";
import htmlContent from "./mailingList.html?raw";

export async function renderMailingList(container: HTMLElement) {
    container.innerHTML = htmlContent;

    const mailingForm = document.getElementById("mailing-list-form") as HTMLFormElement;

    async function submitData(form: HTMLFormElement) {
        const formData: FormData = new FormData(form);
        const firstName = formData.get("entry.1268567619");
        if (firstName && firstName.toString() !== '') {

        } else {
            createMessage({ messageBody: "Please enter your first name", location: "main-message", type: "error", i18n: "please_enter_first" });
            return;
        }
        const lastName = formData.get("entry.116201782");
        if (lastName && lastName.toString() !== "") {

        } else {
            createMessage({ messageBody: "Please enter your last name", location: "main-message", type: "error", i18n: "please_enter_last" });
            return;
        }
        const email = formData.get("entry.1067526779");
        if (email && email.toString() !== '') {
            if (!email.toString().includes("@")) {
                createMessage({ messageBody: "Please enter a valid email", location: "main-message", type: "error", i18n: "please_enter_a_valid_email" });
                return;
            }
        } else {
            createMessage({ messageBody: "Please enter your email", location: "main-message", type: "error", i18n: "please_enter_your_email" });
            return;
        }
        const phoneNumber = formData.get("entry.1476933979");
        if (phoneNumber) {
            const cleaned: string = phoneNumber.toString().replace(/[^\d]/g, "");
            if (cleaned.length < 10 || cleaned.length > 11) {
                createMessage({ messageBody: "Please enter a valid phone number", location: "main-message", type: "error", i18n: "please_valid_phone" });
                return;
            }
        }

        const formAction: string =
            "https://docs.google.com/forms/d/e/1FAIpQLScfzvbbYF0uaPk7fVusRLZ976_PwZMk7qXw2MGw6o8M-fb6Sg/formResponse";
        fetch(formAction, {
            method: "POST",
            body: formData,
            mode: "no-cors",
        })
            .then((response) => {
                //Store the message to be displayed after redirected to the home page
                console.log(response);
                storeMessage(
                    {
                        messageBody: "You have successfully signed up for our mailing list",
                        location: "main-message",
                        type: "check_circle",
                        i18n: "mailing_sign_up_success",
                        autoCloseSeconds: 5
                    }
                );
                router.navigateTo("/");
            })
            .catch((error) => {
                //Create an error message
                console.error("Network Error:", error);
                createMessage(
                    {
                        messageBody: "Error signing up. Please reload the page and try again",
                        location: "main-message",
                        type: "error",
                        i18n: ""
                    }
                );
            });
    }

    mailingForm.addEventListener('submit', (e) => {
        e.preventDefault();
        submitData(mailingForm);
    });
    mailingForm.addEventListener('invalid', (event: Event) => {
        event.preventDefault();
        const target = event.target as HTMLInputElement;
        alert(target)
    }, true);
}