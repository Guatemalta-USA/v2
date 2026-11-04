import { makeElement } from "../modules/utils";

export async function renderAdminPage(container: HTMLElement) {
    container.innerHTML = "";

    const tempP = makeElement("p", null, null, "Admin page contents goes here");
    container.appendChild(tempP);
    
}