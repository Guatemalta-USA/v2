import { makeElement } from "../modules/utils";

export async function renderNotFound(container: HTMLElement, pageId: string, pageTitle?: string) {
    container.innerHTML = "";

    const content = makeElement("div", null, "container", null);
    const pageHeading = makeElement("h2", null, null, null);
    if (pageTitle) {
        pageHeading.textContent = `${pageTitle} not found`;
    } else if (pageId) {
        pageHeading.textContent = `${pageId} not found`;
    }
    

    content.append(pageHeading);
    container.appendChild(content);
}