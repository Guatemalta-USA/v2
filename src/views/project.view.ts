import { makeElement } from "../modules/utils";

export async function renderProjectPage(container: HTMLElement, projectId: string) {
    container.innerHTML = "";

    const tempP = makeElement("p", null, null, `This is project ${projectId}`);
    container.append(tempP);
}